<?php

namespace Tests\Feature\Writing;

use App\Models\Assignment;
use App\Models\AssignmentOverride;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Writing\AssignmentWriter;
use App\Services\Scheduling\Writing\Justificacion;
use App\Services\Scheduling\Writing\Resultado;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL CANDADO. Lo que decide si Turnia es un editor o un adorno.
 *
 * Aquí NO se prueba la interfaz: se prueba que la escritura re-valida DENTRO del candado y que las
 * tres gravedades hacen tres cosas distintas.
 */
class AssignmentWriterTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(array $limites = []): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, array_merge([
            'min_rest_minutes_between_shifts' => 720,
            'max_minutes_week' => 40 * 60,
        ], $limites));

        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $calendar = $this->makeCalendar($company);

        return [$user, $company, $employment, $position, $calendar];
    }

    private function writer(): AssignmentWriter
    {
        return app(AssignmentWriter::class);
    }

    #[Test]
    public function un_turno_limpio_se_escribe(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '12:00', '20:00', calendar: $calendar),
            $user,
        );

        $this->assertSame(Resultado::Escrito, $decision->resultado);
        $this->assertFalse($decision->forzado);
        $this->assertDatabaseCount('assignments', 1);
        $this->assertDatabaseCount('assignment_overrides', 0);
    }

    #[Test]
    public function un_imposible_no_se_escribe_y_dice_por_que(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        // Ya tiene un turno de 10 a 18. Este se le pisa.
        $this->assign($employment, $position, '2026-07-13', '10:00', '18:00', calendar: $calendar);

        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '14:00', '20:00', calendar: $calendar),
            $user,
        );

        $this->assertSame(Resultado::Imposible, $decision->resultado);
        $this->assertDatabaseCount('assignments', 1);   // ⚠️ NO se ha escrito.

        // Y NO se calla el motivo: un "no puedo" sin porqué es un muro.
        $this->assertSame('overlap', $decision->violations[0]['code']);
        $this->assertStringContainsString('10:00', $decision->violations[0]['message']);
    }

    #[Test]
    public function un_incumplimiento_no_se_escribe_sin_decision_humana(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        // La víspera hasta medianoche. Este entra a las 08:00: 8 h de descanso, y el perfil pide 12.
        $this->assign($employment, $position, '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $calendar);

        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '08:00', '16:00', calendar: $calendar),
            $user,
        );

        $this->assertSame(Resultado::NecesitaDecision, $decision->resultado);
        $this->assertDatabaseCount('assignments', 1);   // ⚠️ NO se ha escrito. Se PREGUNTA.
        $this->assertSame('minimum_rest', $decision->violations[0]['code']);
    }

    #[Test]
    public function forzar_escribe_y_deja_constancia_de_quien_cuando_y_por_que(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $this->assign($employment, $position, '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $calendar);

        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '08:00', '16:00', calendar: $calendar),
            $user,
            new Justificacion('Cubre el cierre de la noche anterior.', ['minimum_rest']),
        );

        $this->assertSame(Resultado::Escrito, $decision->resultado);
        $this->assertTrue($decision->forzado);
        $this->assertDatabaseCount('assignments', 2);

        $override = AssignmentOverride::sole();

        $this->assertSame($user->id, $override->user_id);
        $this->assertSame('Cubre el cierre de la noche anterior.', $override->reason);
        $this->assertSame('minimum_rest', $override->violations[0]['code']);
        $this->assertNotNull($override->created_at);
    }

    /**
     * ⚠️ EL TOCTOU DE SEGUNDO ORDEN. El que casi nadie ve.
     *
     * El usuario justificó forzar UNA regla: la que se le enseñó. Entre que dijo «sí» y que el
     * candado se abrió, el estado cambió y ahora incumple OTRA. Su justificación no habla de lo que
     * hay: habla de lo que había. Escribirla igual sería estamparle una firma sobre un contrato que
     * no leyó.
     */
    #[Test]
    public function si_incumple_otra_regla_distinta_de_la_que_firmo_se_le_vuelve_a_preguntar(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo(['max_minutes_week' => 8 * 60]);

        // Ya lleva 8 h esta semana: el tope está justo. Otro turno se pasa del tope semanal.
        $this->assign($employment, $position, '2026-07-13', '08:00', '16:00', calendar: $calendar);

        // Y él viene firmando un DESCANSO CORTO, que no es lo que va a romper.
        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-15', '08:00', '16:00', calendar: $calendar),
            $user,
            new Justificacion('Cubre el cierre.', ['minimum_rest']),
        );

        $this->assertSame(Resultado::NecesitaDecision, $decision->resultado);
        $this->assertTrue($decision->cambioElEstado);
        $this->assertSame('hour_limit', $decision->violations[0]['code']);

        // ⚠️ Y NO se ha escrito, ni se ha guardado su firma sobre una infracción que no vio.
        $this->assertDatabaseCount('assignments', 1);
        $this->assertDatabaseCount('assignment_overrides', 0);
    }

    /**
     * El caso contrario, y también hay que decirlo: iba a forzar y para cuando llegó ya no hacía
     * falta. Se escribe LIMPIO y NO se guarda override — una firma sobre una infracción que nunca
     * ocurrió no pinta nada en el expediente de nadie.
     */
    #[Test]
    public function si_ya_no_incumple_se_escribe_limpio_y_sin_override(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $decision = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '12:00', '20:00', calendar: $calendar),
            $user,
            new Justificacion('Por si acaso.', ['minimum_rest']),
        );

        $this->assertSame(Resultado::Escrito, $decision->resultado);
        $this->assertFalse($decision->forzado);
        $this->assertTrue($decision->cambioElEstado);   // se le dice
        $this->assertDatabaseCount('assignment_overrides', 0);
    }

    #[Test]
    public function mover_un_turno_no_lo_hace_solaparse_consigo_mismo(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $a = $this->assign($employment, $position, '2026-07-13', '12:00', '20:00', calendar: $calendar);

        // Se mueve UNA HORA. Sin ignoreAssignmentId, chocaría con su propia versión vieja.
        $decision = $this->writer()->move(
            $a,
            $this->draft($employment, $position, '2026-07-13', '13:00', '21:00', ignoreAssignmentId: $a->id, calendar: $calendar),
            $user,
        );

        $this->assertSame(Resultado::Escrito, $decision->resultado);
        $this->assertSame('13:00', $employment->company->localTime($a->fresh()->starts_at));
    }

    /**
     * ⚠️ AL MOVER, EL FORZADO VIEJO CADUCA.
     *
     * El override dice «acepté que ESTE turno rompiera el descanso PORQUE cubría el cierre». Movido
     * a otro día, esa frase habla de un turno que ya no existe. Una justificación heredada es una
     * firma sobre otro contrato.
     */
    #[Test]
    public function al_mover_un_turno_forzado_su_justificacion_caduca(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $this->assign($employment, $position, '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $calendar);

        $forzado = $this->writer()->place(
            $this->draft($employment, $position, '2026-07-13', '08:00', '16:00', calendar: $calendar),
            $user,
            new Justificacion('Cubre el cierre.', ['minimum_rest']),
        )->assignment;

        $this->assertDatabaseCount('assignment_overrides', 1);

        // Se mueve a un día donde ya no incumple nada.
        $decision = $this->writer()->move(
            $forzado,
            $this->draft($employment, $position, '2026-07-16', '08:00', '16:00', ignoreAssignmentId: $forzado->id, calendar: $calendar),
            $user,
        );

        $this->assertSame(Resultado::Escrito, $decision->resultado);
        $this->assertFalse($decision->forzado);
        $this->assertDatabaseCount('assignment_overrides', 0);
    }

    #[Test]
    public function quitar_borra_el_turno(): void
    {
        [, , $employment, $position, $calendar] = $this->mundo();

        $a = $this->assign($employment, $position, '2026-07-13', '12:00', '20:00', calendar: $calendar);

        $decision = $this->writer()->remove($a);

        $this->assertSame(Resultado::Quitado, $decision->resultado);
        $this->assertSoftDeleted($a);
        $this->assertSame(0, Assignment::count());
    }

    /**
     * ⚠️ EL CASO PEOR DEL TOCTOU, Y EL QUE JUSTIFICA TODA ESTA CLASE.
     *
     * NO es el duplicado evidente —ese se ve—: son DOS TURNOS DISTINTOS, EN DÍAS DISTINTOS, que
     * INDIVIDUALMENTE cumplen el descanso y JUNTOS lo rompen.
     *
     * Aquí se demuestra en un proceso: el segundo `place` re-valida DENTRO del candado, ya con el
     * primero escrito, y lo caza. Si reutilizara la validación de la previsualización —hecha antes,
     * cuando el primero no existía— diría «limpio» y escribiría. Silencio falso por concurrencia.
     *
     * (Los dos procesos peleándose de verdad contra InnoDB se prueban con dos navegadores: ver
     * tests/Visual/concurrencia.mjs.)
     */
    #[Test]
    public function dos_turnos_que_por_separado_cumplen_y_juntos_no_se_cazan_dentro_del_candado(): void
    {
        [$user, , $employment, $position, $calendar] = $this->mundo();

        $tarde = $this->draft($employment, $position, '2026-07-15', '14:00', '22:00', calendar: $calendar);
        $madrugada = $this->draft($employment, $position, '2026-07-16', '02:00', '06:00', calendar: $calendar);

        // ⚠️ Los DOS están limpios contra el estado de AHORA. Es la foto que vería una
        // previsualización hecha antes de escribir nada.
        $validador = app(AssignmentValidator::class);
        $this->assertTrue($validador->validate($tarde)->isClean());
        $this->assertTrue($validador->validate($madrugada)->isClean());

        // El primero entra.
        $this->assertSame(Resultado::Escrito, $this->writer()->place($tarde, $user)->resultado);

        // Y el segundo, al RE-VALIDAR dentro del candado, se encuentra al primero. 4 h de descanso
        // donde el perfil exige 12.
        $decision = $this->writer()->place($madrugada, $user);

        $this->assertSame(Resultado::NecesitaDecision, $decision->resultado);
        $this->assertSame('minimum_rest', $decision->violations[0]['code']);
        $this->assertDatabaseCount('assignments', 1);
    }
}
