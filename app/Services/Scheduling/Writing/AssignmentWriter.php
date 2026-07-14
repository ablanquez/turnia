<?php

namespace App\Services\Scheduling\Writing;

use App\Models\Assignment;
use App\Models\AssignmentOverride;
use App\Models\Person;
use App\Models\User;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Closure;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EL ÚNICO SITIO DE TURNIA QUE ESCRIBE UN TURNO. Y NO ESCRIBE NADA FUERA DEL CANDADO.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ LEE docs/ESTRES-MOTOR.md §4 ANTES DE TOCAR ESTO.
 *
 * LA LEY DE ESTA CLASE, Y NO ADMITE MATICES:
 *
 *     LA VALIDACIÓN QUE SE ENSEÑA AL ARRASTRAR ES UNA **PREVISUALIZACIÓN**.
 *     LA VALIDACIÓN QUE **DECIDE** ES LA QUE CORRE **DENTRO DEL CANDADO**.
 *     NO SON LA MISMA LLAMADA, Y CONFUNDIRLAS REABRE EL AGUJERO ENTERO.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * EL AGUJERO (reproducido en ConcurrencyTest, no supuesto):
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * Dos escrituras validan a la vez contra el mismo estado. Las dos reciben «limpio». Las dos
 * escriben. **EL RESULTADO COMBINADO NUNCA SE VALIDÓ CONTRA NADA**, y nadie recibió un aviso.
 *
 * Y el caso peor NO es el duplicado evidente —ese se ve— sino **dos turnos DISTINTOS, en días
 * DISTINTOS, que INDIVIDUALMENTE cumplen el descanso y JUNTOS lo rompen**. Silencio falso por
 * concurrencia: el peor modo de fallo que tiene esta aplicación.
 *
 * ⚠️ Y ESTO PASA AUNQUE SOLO HAYA UN USUARIO. Dos pestañas. O uno que arrastra, se distrae, y
 * suelta cinco minutos después — cuando su compañero ya registró una baja.
 *
 *     EL TOCTOU NO ES «DOS PERSONAS A LA VEZ».
 *     ES «EL ESTADO CAMBIÓ ENTRE QUE COMPROBÉ Y ESCRIBÍ».
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ POR QUÉ EL CANDADO VA SOBRE LA **PERSONA**
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * El SOLAPE y el DESCANSO —las dos reglas que la concurrencia puede romper— se validan a nivel
 * de PERSONA, y cruzan empresas. Bloquear la persona serializa EXACTAMENTE las escrituras que
 * pueden interferir entre sí, y deja pasar en paralelo todas las demás.
 *
 *   · Bloquear la EMPRESA serializaría de más: dos encargados tocando a dos personas distintas
 *     no se estorban, y estarían haciendo cola.
 *   · Bloquear la ASIGNACIÓN serializaría de menos: el caso peor son DOS ASIGNACIONES DISTINTAS.
 *     Un candado sobre cada una no las hace hablar entre sí, que es justo lo que hace falta.
 *
 * Y por eso el candado es `Person::lockForUpdate()` — la fila que las dos escrituras comparten.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ Y LA SEPARACIÓN NO DEPENDE DE QUE YO ME ACUERDE: DEPENDE DE LA FIRMA.
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * NINGÚN método de esta clase acepta un `ValidationResult` de fuera. No se le puede decir «ya lo
 * validé, escribe». **El tipo no lo permite.** Si mañana alguien quisiera «optimizar» pasándole
 * el resultado de la previsualización, tendría que cambiar la firma A PROPÓSITO — y entonces ya
 * no es un descuido, es una decisión, y este comentario está aquí para que la piense dos veces.
 */
final class AssignmentWriter
{
    public function __construct(private AssignmentValidator $validator) {}

    /** Colocar un turno nuevo. */
    public function place(AssignmentDraft $draft, User $user, ?Justificacion $forzar = null): Decision
    {
        return $this->bajoElCandado(
            $draft,
            $user,
            $forzar,
            fn () => Assignment::create([
                'calendar_id' => $draft->calendarId,
                'employment_id' => $draft->employment->id,
                'position_id' => $draft->position->id,
                'work_date' => $draft->workDate->toDateString(),
                'starts_at' => $draft->startsAt,
                'ends_at' => $draft->endsAt,
            ]),
        );
    }

    /**
     * Mover un turno: otro día, otro puesto, otras horas.
     *
     * El draft lleva `ignoreAssignmentId`, así que el turno no se compara consigo mismo — si no,
     * moverlo un minuto daría siempre un solape contra su propia versión vieja.
     */
    public function move(Assignment $assignment, AssignmentDraft $draft, User $user, ?Justificacion $forzar = null): Decision
    {
        return $this->bajoElCandado($draft, $user, $forzar, function () use ($assignment, $draft) {
            $assignment->update([
                'position_id' => $draft->position->id,
                'work_date' => $draft->workDate->toDateString(),
                'starts_at' => $draft->startsAt,
                'ends_at' => $draft->endsAt,
            ]);

            /*
             * ⚠️ AL MOVER, EL FORZADO VIEJO SE CAE. Y no es limpieza: es que ha caducado.
             *
             * El override dice «yo, Ana, el martes, acepté que este turno rompiera el descanso
             * PORQUE cubría el cierre». Si el turno se mueve a otro día, esa frase ya no habla de
             * este turno: habla de uno que ya no existe. Mantenerla sería una justificación
             * heredada — una firma sobre un contrato distinto del que se firmó.
             *
             * Si el turno movido SIGUE incumpliendo, se vuelve a preguntar y se vuelve a firmar.
             */
            $assignment->override()->delete();

            return $assignment->fresh();
        });
    }

    /**
     * Quitar un turno.
     *
     * ⚠️ NO SE VALIDA NADA, Y SÍ SE COGE EL CANDADO. Las dos cosas a propósito.
     *
     * No se valida porque quitar un turno NO PUEDE crear una violación en el turno que se quita:
     * el turno deja de existir. Puede dejar un HUECO de cobertura —que no es una violación, es un
     * hecho— y puede ARREGLAR violaciones de otros. Las dos cosas las dirá el informe diferido,
     * sobre el estado real.
     *
     * Y sí se coge el candado porque la invariante de esta clase es una y no admite excepciones:
     * NINGUNA ESCRITURA TOCA LA BASE SIN EL CANDADO DE LA PERSONA. Una excepción «porque este caso
     * es inofensivo» es exactamente cómo se pudre una invariante.
     */
    public function remove(Assignment $assignment): Decision
    {
        return DB::transaction(function () use ($assignment) {
            Person::whereKey($assignment->person_id)->lockForUpdate()->first();

            $assignment->delete();

            return Decision::quitado();
        });
    }

    /**
     * EL CANDADO. Todo lo que escribe pasa por aquí, y aquí se RE-VALIDA. Siempre.
     *
     * @param  Closure(): Assignment  $persistir
     */
    private function bajoElCandado(AssignmentDraft $draft, User $user, ?Justificacion $forzar, Closure $persistir): Decision
    {
        return DB::transaction(function () use ($draft, $user, $forzar, $persistir) {
            /*
             * ⚠️ ESTA LÍNEA ES LA TANDA. Serializa a las demás escrituras sobre ESTA persona.
             *
             * A partir de aquí, y hasta que la transacción cierre, nadie más puede escribir un
             * turno suyo. Lo que el validador vea a continuación es el estado REAL, y va a seguir
             * siéndolo cuando escribamos tres líneas más abajo.
             */
            Person::whereKey($draft->personId())->lockForUpdate()->first();

            // ⚠️ Y AQUÍ SE RE-VALIDA. No se reutiliza NADA de la previsualización.
            $result = $this->validator->validate($draft);

            if (! $result->isPossible()) {
                return Decision::imposible($this->comoArray($result->impossibles()));
            }

            $breaches = $result->breaches();

            // Limpio, o solo con avisos: se escribe y punto. Un aviso informa, no pide permiso.
            if ($breaches->isEmpty()) {
                $assignment = $persistir();

                /*
                 * ⚠️ VENÍA UNA JUSTIFICACIÓN PARA UN INCUMPLIMIENTO QUE YA NO EXISTE.
                 *
                 * Entre que se le preguntó «¿fuerzas?» y que contestó «sí», alguien arregló el
                 * problema. Se escribe LIMPIO y NO se crea override: guardar la decisión de forzar
                 * algo que ya no incumple sería dejar en el expediente de esa persona una firma
                 * sobre una infracción que nunca ocurrió.
                 */
                return Decision::escrito($assignment, forzado: false, cambio: $forzar !== null);
            }

            // Incumple, y nadie ha decidido nada: no se escribe. Se pregunta.
            if ($forzar === null) {
                return Decision::necesitaDecision($this->comoArray($breaches));
            }

            /*
             * ⚠️ EL TOCTOU DE SEGUNDO ORDEN, Y ES EL QUE CASI NADIE VE.
             *
             * El usuario justificó forzar UNAS reglas concretas: las que se le enseñaron. Si al
             * entrar en el candado resulta que ahora incumple OTRAS, su justificación no habla de
             * lo que hay: habla de lo que había. Escribirla igual sería estamparle una firma sobre
             * un contrato que no leyó — y en `assignment_overrides` quedaría, negro sobre blanco,
             * que aceptó algo que nadie le enseñó.
             *
             * Así que se le vuelve a preguntar, con los motivos NUEVOS.
             */
            $ahora = $breaches->map(fn ($v) => $v->code->value)->unique()->sort()->values()->all();

            if ($ahora !== $forzar->codigosOrdenados()) {
                return Decision::necesitaDecision($this->comoArray($breaches), cambio: true);
            }

            $assignment = $persistir();

            /*
             * LA DECISIÓN HUMANA SE GUARDA. Es el único dato de toda la app que NO se deriva.
             *
             * El incumplimiento se DERIVA (re-validando), porque depende de otras filas y uno
             * guardado se volvería mentira sin que nadie lo tocara. Pero «quién decidió, cuándo y
             * por qué» no se deduce de ninguna fila: o se guarda, o se pierde.
             *
             * ⚠️ Y `violations` guarda LO QUE VIO EL CANDADO, no lo que se le enseñó en pantalla.
             * Son lo mismo (acabamos de comprobarlo tres líneas arriba), pero la fuente es esta:
             * el expediente cuenta lo que PASÓ, no lo que se creía que iba a pasar.
             */
            /*
             * ⚠️ `user_id` NO ES `fillable`, Y SE ASIGNA A MANO. Las dos cosas a propósito.
             *
             * Quién firmó sale de LA SESIÓN, jamás de la petición. Si `user_id` fuera asignable en
             * masa, un `force[user_id]` colado en el cuerpo del POST bastaría para firmar una
             * infracción con el nombre de otro. Y el registro de decisiones humanas es lo único que
             * un inspector va a mirar: si se puede falsificar, no vale nada.
             *
             * (En los seeders esto colaba porque `db:seed` corre con `Model::unguarded()`. En
             * producción no, y ahí está la diferencia entre un dato y una firma.)
             */
            $override = new AssignmentOverride([
                'reason' => $forzar->motivo,
                'violations' => $this->comoArray($breaches),
            ]);

            $override->user_id = $user->id;

            $assignment->override()->save($override);

            return Decision::escrito($assignment->fresh(), forzado: true);
        });
    }

    /** @return array<int, array<string, mixed>> */
    private function comoArray(Collection $violations): array
    {
        return $violations->map(fn ($v) => $v->toArray())->values()->all();
    }
}
