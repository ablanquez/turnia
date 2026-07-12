<?php

namespace Tests\Feature\Stress;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\Person;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * BLOQUE 5: TOCTOU (Time Of Check, Time Of Use).
 *
 * El motor valida contra el estado que ve. Si dos encargados validan a la vez, los dos
 * ven el MISMO estado, los dos reciben OK, y los dos escriben. El resultado combinado
 * nunca se validó contra nada.
 *
 * Es un SILENCIO FALSO POR CONCURRENCIA: nadie recibió un aviso, y el cuadrante queda
 * ilegal.
 *
 * Estos tests NO arreglan nada: DEMUESTRAN el agujero. El arreglo vive en la capa que
 * escribe (la parrilla), y está diseñado y documentado en docs/ESTRES-MOTOR.md.
 */
class ConcurrencyTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function dos_encargados_validan_el_mismo_hueco_a_la_vez_y_los_dos_reciben_ok(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $position = $this->makePosition($company);

        $maria = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company));
        $maria->positions()->attach($position);

        $validator = app(AssignmentValidator::class);

        // Los dos encargados preparan el MISMO turno para María, a la vez.
        $encargadoA = $this->draft($maria, $position, '2026-07-15', '09:00', '17:00');
        $encargadoB = $this->draft($maria, $position, '2026-07-15', '09:00', '17:00');

        // Ambos validan contra el mismo estado (vacío): los dos, limpios.
        $this->assertTrue($validator->validate($encargadoA)->isClean());
        $this->assertTrue($validator->validate($encargadoB)->isClean());

        // Y ambos escriben.
        $this->escribir($encargadoA);
        $this->escribir($encargadoB);

        // Resultado: María duplicada en el mismo turno. Y NADIE recibió un aviso.
        $this->assertSame(2, Assignment::count());

        $reValidado = $validator->validate(
            AssignmentDraft::fromAssignment(Assignment::first())
        );

        $this->assertTrue(
            $reValidado->has(RuleCode::Overlap),
            'El conjunto resultante es ilegal, y ninguno de los dos encargados fue avisado.',
        );
    }

    #[Test]
    public function dos_turnos_que_por_separado_cumplen_el_descanso_juntos_lo_rompen(): void
    {
        // EL CASO PEOR, y el que de verdad da miedo: no es un duplicado evidente. Son
        // dos turnos DISTINTOS, en días distintos, que individualmente cumplen. Juntos,
        // el descanso entre ellos es de 4 horas.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['min_rest_minutes_between_shifts' => 720]);

        $maria = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $maria->positions()->attach($position);

        $validator = app(AssignmentValidator::class);

        // Encargado A prepara el turno de tarde del día 15 (acaba a las 22:00).
        $tarde = $this->draft($maria, $position, '2026-07-15', '14:00', '22:00');

        // Encargado B prepara la madrugada del día 16 (empieza a las 02:00).
        $madrugada = $this->draft($maria, $position, '2026-07-16', '02:00', '06:00');

        // Validados CONTRA EL MISMO ESTADO VACÍO: los dos limpios. Y es correcto: por
        // separado, ninguno rompe nada.
        $this->assertTrue($validator->validate($tarde)->isClean());
        $this->assertTrue($validator->validate($madrugada)->isClean());

        $this->escribir($tarde);
        $this->escribir($madrugada);

        // Pero juntos: solo 4 horas de descanso, y el perfil exige 12.
        $reValidado = $validator->validate(
            AssignmentDraft::fromAssignment(Assignment::orderByDesc('id')->first())
        );

        $this->assertTrue(
            $reValidado->has(RuleCode::MinimumRest),
            'Dos turnos que individualmente cumplen, juntos rompen el descanso, y nadie avisó.',
        );

        // Nótese la diferencia con el caso secuencial: si el encargado B hubiera validado
        // DESPUÉS de que A escribiera, habría visto el aviso. El agujero no está en las
        // reglas: está en la ventana entre validar y escribir.
    }

    #[Test]
    public function validar_dentro_de_una_transaccion_con_bloqueo_cierra_la_carrera(): void
    {
        // LA SOLUCIÓN PROPUESTA, demostrada aquí en pequeño (la implementación vive en la
        // capa que escribe, tanda de la parrilla).
        //
        // Al modo Laravel: DB::transaction + lockForUpdate sobre la PERSONA. La persona
        // es el candado natural porque el solape y el descanso se validan a nivel de
        // persona: dos escrituras que afectan a la misma persona se serializan; dos que
        // afectan a personas distintas siguen yendo en paralelo.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['min_rest_minutes_between_shifts' => 720]);

        $maria = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $maria->positions()->attach($position);

        $tarde = $this->draft($maria, $position, '2026-07-15', '14:00', '22:00');
        $madrugada = $this->draft($maria, $position, '2026-07-16', '02:00', '06:00');

        // El primero entra.
        $this->assertTrue($this->escribirConCandado($tarde));

        // El segundo RE-VALIDA dentro de la transacción, ya con el primero escrito, y se
        // encuentra el incumplimiento. La carrera se ha cerrado.
        $this->assertFalse(
            $this->escribirConCandado($madrugada),
            'Con re-validación dentro del candado, el segundo turno ya no entra a ciegas.',
        );

        $this->assertSame(1, Assignment::count());
    }

    private function escribir(AssignmentDraft $draft): Assignment
    {
        return Assignment::create([
            'calendar_id' => $this->makeCalendar($draft->employment->company)->id,
            'employment_id' => $draft->employment->id,
            'position_id' => $draft->position->id,
            'work_date' => $draft->workDate->toDateString(),
            'starts_at' => $draft->startsAt,
            'ends_at' => $draft->endsAt,
        ]);
    }

    /** El patrón propuesto: bloquear la persona, RE-validar dentro, y solo entonces escribir. */
    private function escribirConCandado(AssignmentDraft $draft): bool
    {
        return DB::transaction(function () use ($draft) {
            Person::query()
                ->whereKey($draft->personId())
                ->lockForUpdate()
                ->first();

            $result = app(AssignmentValidator::class)->validate($draft);

            // Aquí la política es de la capa de escritura: en este ejemplo, no se escribe
            // nada que no esté limpio. En la parrilla real, un incumplimiento se podrá
            // forzar dejando constancia (assignment_overrides), pero la decisión se toma
            // con el estado YA bloqueado, no con una foto vieja.
            if (! $result->isClean()) {
                return false;
            }

            $this->escribir($draft);

            return true;
        });
    }
}
