<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL BORDE ES DONDE VIVEN LOS BUGS.
 *
 * Cada uno de estos casos está a un solo minuto (o a un solo signo de comparación)
 * de comportarse al revés.
 */
class EdgeCaseTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(array $limits = []): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, $limits);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        return compact('user', 'company', 'employment', 'position');
    }

    // ─────────── EL BORDE DEL SOLAPE ───────────

    #[Test]
    public function un_turno_que_acaba_a_las_22_y_otro_que_empieza_a_las_22_no_solapan(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        $draft = $this->draft($employment, $position, '2026-07-15', '22:00', '23:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        // Intervalos semiabiertos [inicio, fin). Si esto fallara, ningún turno
        // consecutivo sería legal y la parrilla sería inusable.
        $this->assertFalse($result->has(RuleCode::Overlap));
    }

    #[Test]
    public function un_solo_minuto_de_pisada_ya_es_solape(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        $draft = $this->draft($employment, $position, '2026-07-15', '21:59', '23:00');

        $this->assertTrue(app(AssignmentValidator::class)->validate($draft)->has(RuleCode::Overlap));
    }

    // ─────────── EL BORDE DEL DESCANSO ───────────

    #[Test]
    public function descansar_exactamente_las_12_horas_que_pide_el_perfil_cumple(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'min_rest_minutes_between_shifts' => 720, // 12h
        ]);

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        // Acaba a las 22:00, entra a las 10:00. Exactamente 12h.
        $draft = $this->draft($employment, $position, '2026-07-16', '10:00', '14:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        // Es un MÍNIMO: 12 >= 12 cumple.
        $this->assertFalse($result->has(RuleCode::MinimumRest));
    }

    #[Test]
    public function un_solo_minuto_menos_de_descanso_ya_incumple(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'min_rest_minutes_between_shifts' => 720,
        ]);

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        $draft = $this->draft($employment, $position, '2026-07-16', '09:59', '14:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::MinimumRest));
        $this->assertTrue($result->isPossible(), 'El descanso corto AVISA, pero deja colocar.');
    }

    #[Test]
    public function colocar_un_turno_puede_romper_el_descanso_del_turno_que_venia_detras(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'min_rest_minutes_between_shifts' => 720,
        ]);

        // Ya hay un turno el día 17 por la mañana.
        $this->assign($employment, $position, '2026-07-17', '09:00', '13:00');

        // Y ahora meten uno el 16 hasta muy tarde: rompe el descanso del SIGUIENTE.
        $draft = $this->draft($employment, $position, '2026-07-16', '18:00', '02:00', endDate: '2026-07-17');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::MinimumRest), 'Solo se miró hacia atrás, no hacia delante.');
    }

    #[Test]
    public function la_jornada_partida_no_incumple_el_descanso_minimo(): void
    {
        // El perfil permite jornada partida Y exige 12h de descanso entre jornadas.
        // Entre las dos mitades de una partida hay 4h. Si la regla las mira como si
        // fueran dos jornadas, TODA jornada partida incumpliría y el motor sería
        // inútil en el sector que más partidas hace: la hostelería.
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'min_rest_minutes_between_shifts' => 720,
            'workday_type' => 'split',
        ]);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        $draft = $this->draft($employment, $position, '2026-07-15', '17:00', '21:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertFalse(
            $result->has(RuleCode::MinimumRest),
            'El descanso ENTRE JORNADAS se está aplicando DENTRO de una jornada partida.',
        );
    }

    #[Test]
    public function el_descanso_si_se_exige_entre_dias_distintos(): void
    {
        // Contrapunto del anterior: que la partida no incumpla no puede significar
        // que el descanso deje de comprobarse entre días.
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'min_rest_minutes_between_shifts' => 720,
        ]);

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        $draft = $this->draft($employment, $position, '2026-07-16', '02:00', '06:00'); // 4h de descanso

        $this->assertTrue(app(AssignmentValidator::class)->validate($draft)->has(RuleCode::MinimumRest));
    }

    #[Test]
    public function un_turno_que_empieza_justo_al_acabar_una_hora_medica_no_solapa(): void
    {
        ['company' => $company, 'employment' => $employment, 'position' => $position] = $this->mundo();

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');
        $this->addConcept($employment, $medica, '2026-07-15', '10:00', '12:00');

        $draft = $this->draft($employment, $position, '2026-07-15', '12:00', '18:00');

        $this->assertFalse(app(AssignmentValidator::class)->validate($draft)->has(RuleCode::Overlap));
    }

    // ─────────── EL BORDE DEL TOPE DE HORAS ───────────

    #[Test]
    public function llegar_exactamente_al_tope_semanal_cumple(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'max_minutes_week' => 2400, // 40h
        ]);

        // 32h ya puestas.
        foreach (['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'] as $day) {
            $this->assign($employment, $position, $day, '09:00', '17:00');
        }

        // Las 8h que faltan: quedaría en 40h de 40h exactas.
        $draft = $this->draft($employment, $position, '2026-07-17', '09:00', '17:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        // Es un MÁXIMO: 40 <= 40 cumple.
        $this->assertFalse($result->has(RuleCode::HourLimit));
    }

    #[Test]
    public function pasarse_un_solo_minuto_del_tope_ya_incumple(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'max_minutes_week' => 2400,
        ]);

        foreach (['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'] as $day) {
            $this->assign($employment, $position, $day, '09:00', '17:00');
        }

        $draft = $this->draft($employment, $position, '2026-07-17', '09:00', '17:01');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::HourLimit));
        $this->assertTrue($result->isPossible(), 'Pasarse de horas AVISA, pero deja colocar.');

        $violation = $result->violations->first(fn ($v) => $v->code === RuleCode::HourLimit);
        $this->assertSame(1, $violation->context['excess_minutes']);
    }

    #[Test]
    public function sin_tope_definido_no_se_incumple_nunca_por_horas(): void
    {
        // Perfil con TODOS los límites a null: null = SIN LÍMITE, no cero.
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        foreach (['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'] as $day) {
            $this->assign($employment, $position, $day, '06:00', '22:00'); // 16h/día = 80h
        }

        $draft = $this->draft($employment, $position, '2026-07-18', '06:00', '22:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        // Si null se tratara como cero, esto reventaría con un incumplimiento.
        $this->assertFalse($result->has(RuleCode::HourLimit));
    }

    // ─────────── INTERVALOS CORRUPTOS ───────────

    #[Test]
    public function un_turno_de_duracion_cero_es_imposible(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $draft = $this->draft($employment, $position, '2026-07-15', '09:00', '09:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::InvalidInterval));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function un_turno_que_acaba_antes_de_empezar_es_imposible(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $draft = $this->draft($employment, $position, '2026-07-15', '17:00', '09:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::InvalidInterval));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function un_turno_de_mas_de_24_horas_es_imposible_aunque_no_haya_limite_de_perfil(): void
    {
        // Sin max_minutes_per_shift: "sin límite" es un parámetro de negocio, pero
        // un día tiene 24 horas y eso no lo configura nadie.
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $draft = $this->draft($employment, $position, '2026-07-15', '09:00', '10:00', endDate: '2026-07-16');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::ShiftTooLong));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function un_turno_de_exactamente_24_horas_es_posible(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $draft = $this->draft($employment, $position, '2026-07-15', '09:00', '09:00', endDate: '2026-07-16');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertFalse($result->has(RuleCode::ShiftTooLong));
        $this->assertFalse($result->has(RuleCode::InvalidInterval));
    }

    // ─────────── ESTADOS RAROS ───────────

    #[Test]
    public function no_se_puede_asignar_un_turno_a_un_contrato_ya_terminado(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo();

        $employment->update(['ends_on' => '2026-06-30']);

        $draft = $this->draft($employment->fresh(), $position, '2026-07-15', '09:00', '17:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::ContractInactive));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function no_se_puede_asignar_un_turno_antes_de_que_empiece_el_contrato(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), null, ['starts_on' => '2026-08-01']);
        $position = $this->makePosition($company);

        $draft = $this->draft($employment, $position, '2026-07-15', '09:00', '17:00');

        $this->assertTrue(app(AssignmentValidator::class)->validate($draft)->has(RuleCode::ContractInactive));
    }

    #[Test]
    public function un_contrato_sin_perfil_avisa_de_que_no_tiene_condiciones(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), profile: null);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );

        // El silencio no es lo mismo que "todo correcto".
        $this->assertTrue($result->has(RuleCode::MissingProfile));
        $this->assertTrue($result->isPossible(), 'Falta configuración: avisa, pero deja colocar.');
    }

    #[Test]
    public function una_baja_abierta_que_empezo_hace_un_ano_sigue_bloqueando_hoy(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $maria = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $maria);
        $position = $this->makePosition($company);

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person);
        $this->addAbsence($maria, $baja, '2025-07-01', endsOn: null);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );

        $this->assertTrue($result->has(RuleCode::Unavailable));
    }

    #[Test]
    public function no_estar_cualificado_avisa_pero_deja_colocar(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $almacen = $this->makePosition($company, 'Almacén');
        // NO se le adjunta el puesto: no está cualificado.

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $almacen, '2026-07-15', '09:00', '17:00')
        );

        $this->assertTrue($result->has(RuleCode::Eligibility));
        $this->assertTrue($result->isPossible(), 'La cualificación AVISA, no bloquea.');
    }

    // ─────────── MOVER UNA ASIGNACIÓN ───────────

    #[Test]
    public function al_mover_una_asignacion_no_solapa_ni_choca_consigo_misma(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo([
            'max_minutes_week' => 480, // 8h justas
            'min_rest_minutes_between_shifts' => 720,
        ]);

        $existente = $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        // Se mueve ESA MISMA asignación una hora más tarde.
        $draft = $this->draft($employment, $position, '2026-07-15', '10:00', '18:00',
            ignoreAssignmentId: $existente->id);

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->isClean(), 'La asignación está chocando contra su propia versión antigua.');
    }
}
