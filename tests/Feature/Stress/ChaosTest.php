<?php

namespace Tests\Feature\Stress;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\Recurrence;
use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Services\Scheduling\CoverageCalculator;
use App\Services\Scheduling\HourCounter;
use App\Services\Scheduling\LeaveQuota;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceValidator;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\WindowResolver;
use App\Services\Scheduling\WorkdayCalendar;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * BLOQUE 6: absurdos pero POSIBLES.
 *
 * Nada de esto debería pasar. Todo esto va a pasar.
 */
class ChaosTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    // ─────────── EL CERO QUE NO ES NULL ───────────

    #[Test]
    public function un_tope_semanal_de_cero_es_cero_horas_y_no_sin_limite(): void
    {
        // La confusión que más bugs produce. 0 y null NO son lo mismo.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_minutes_week' => 0]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '10:00')
        );

        $this->assertTrue($result->has(RuleCode::HourLimit), 'Un tope de 0 se está tratando como "sin límite".');
    }

    #[Test]
    public function un_cupo_de_cero_dias_de_vacaciones_es_cero(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 0]));

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-15', '2026-07-15', $employment)
        );

        $this->assertTrue($result->has(RuleCode::LeaveQuota));
    }

    // ─────────── DÍAS LABORABLES DEGENERADOS ───────────

    #[Test]
    public function una_empresa_que_no_abre_nunca_no_tiene_dias_laborables(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['non_working_weekdays' => [1, 2, 3, 4, 5, 6, 7]]);

        $dias = app(WorkdayCalendar::class)->countWorkingDays(
            $company,
            CarbonImmutable::parse('2026-07-01'),
            CarbonImmutable::parse('2026-07-31'),
        );

        $this->assertSame(0, $dias);
    }

    #[Test]
    public function un_cupo_que_nunca_se_consume_porque_no_hay_dias_laborables_es_coherente_pero_inutil(): void
    {
        // CONSECUENCIA LÓGICA, NO BUG: si la empresa no abre nunca, unas vacaciones no
        // consumen cupo (no ibas a trabajar ningún día). El motor es coherente. Pero el
        // resultado es que el cupo deja de vigilar nada, y eso hay que SABERLO.
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['non_working_weekdays' => [1, 2, 3, 4, 5, 6, 7]]);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 1]));

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-01-01', '2026-12-31', $employment)
        );

        $this->assertFalse($result->has(RuleCode::LeaveQuota));
    }

    #[Test]
    public function un_festivo_que_cae_en_un_dia_ya_no_laborable_no_se_descuenta_dos_veces(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user); // sábado y domingo no laborables
        $this->makeHoliday($company, '2026-07-18'); // sábado

        // Del lunes 13 al domingo 19: 5 laborables (lun-vie). El festivo del sábado no
        // resta nada, porque el sábado ya no contaba.
        $dias = app(WorkdayCalendar::class)->countWorkingDays(
            $company,
            CarbonImmutable::parse('2026-07-13'),
            CarbonImmutable::parse('2026-07-19'),
        );

        $this->assertSame(5, $dias);
    }

    // ─────────── AUSENCIAS DEGENERADAS ───────────

    #[Test]
    public function una_baja_dentro_de_otra_baja_se_denuncia(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $this->makeEmployment($company, $person);

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja');

        $this->addAbsence($person, $baja, '2026-01-01', '2026-12-31');

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $baja, '2026-06-01', '2026-06-15')
        );

        $this->assertTrue($result->has(RuleCode::DuplicateAbsence));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function una_ausencia_de_cinco_anos_se_calcula_sin_reventar(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 22]));

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-01-01', '2030-12-31', $employment)
        );

        // Se pasa del cupo en CADA uno de los cinco años de cómputo que toca.
        $excesos = $result->violations->filter(fn ($v) => $v->code === RuleCode::LeaveQuota);

        $this->assertCount(5, $excesos, 'La ausencia larga debe consumir de cada año que toca, no de uno.');
    }

    #[Test]
    public function un_contrato_que_empieza_y_termina_el_mismo_dia_admite_un_turno_ese_dia(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company), [
            'starts_on' => '2026-07-15',
            'ends_on' => '2026-07-15',
        ]);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $dentro = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );
        $fuera = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-16', '09:00', '17:00')
        );

        $this->assertFalse($dentro->has(RuleCode::ContractInactive));
        $this->assertTrue($fuera->has(RuleCode::ContractInactive));
    }

    // ─────────── FECHAS ABSURDAS ───────────

    #[Test]
    public function fechas_absurdas_en_1900_y_2200_no_revientan_el_contador(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), null, ['starts_on' => '1900-01-01']);
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '1900-06-15', '09:00', '17:00');
        $this->assign($employment, $position, '2200-06-15', '09:00', '17:00');

        $windows = app(WindowResolver::class);
        $counter = app(HourCounter::class);

        $this->assertSame(480, $counter->workedMinutes($employment,
            $windows->computationYear($company, CarbonImmutable::parse('1900-06-15'))));
        $this->assertSame(480, $counter->workedMinutes($employment,
            $windows->computationYear($company, CarbonImmutable::parse('2200-06-15'))));
    }

    // ─────────── VOLUMEN ABSURDO ───────────

    #[Test]
    public function una_persona_con_cinco_contratos_en_cinco_empresas(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $employments = [];
        $positions = [];

        for ($i = 1; $i <= 5; $i++) {
            $company = $this->makeCompany($user, ['name' => "Empresa {$i}"]);
            $profile = $this->makeProfile($company, ['min_rest_minutes_between_shifts' => 720]);
            $employment = $this->makeEmployment($company, $maria, $profile);
            $position = $this->makePosition($company, "Puesto {$i}");
            $employment->positions()->attach($position);

            $employments[] = $employment;
            $positions[] = $position;
        }

        // Trabaja en las cuatro primeras el mismo día, sin solaparse.
        $horas = [['08:00', '10:00'], ['11:00', '13:00'], ['14:00', '16:00'], ['17:00', '19:00']];

        foreach ($horas as $i => [$de, $a]) {
            $this->assign($employments[$i], $positions[$i], '2026-07-15', $de, $a);
        }

        // Y ahora la quinta empresa la quiere de 09:00 a 11:00: solapa con la primera.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employments[4], $positions[4], '2026-07-15', '09:00', '11:00')
        );

        $this->assertTrue($result->has(RuleCode::Overlap), 'El solape debe cruzar las CINCO empresas.');

        // Y el aviso del día compartido debe nombrar a las cuatro.
        $notice = $result->violations->first(fn ($v) => $v->code === RuleCode::SharedWorkday);
        $this->assertCount(4, $notice->context['company_ids']);
    }

    #[Test]
    public function doscientas_asignaciones_en_una_semana_no_cuelgan_el_motor(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company));
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        // 200 turnos de 5 minutos, todos el mismo día. Absurdo, pero posible.
        for ($i = 0; $i < 200; $i++) {
            $minute = str_pad((string) ($i % 60), 2, '0', STR_PAD_LEFT);
            $hour = str_pad((string) (8 + intdiv($i, 60)), 2, '0', STR_PAD_LEFT);

            Assignment::create([
                'calendar_id' => $this->makeCalendar($company)->id,
                'employment_id' => $employment->id,
                'position_id' => $position->id,
                'work_date' => '2026-07-15',
                'starts_at' => $company->toUtc('2026-07-15', "{$hour}:{$minute}"),
                'ends_at' => $company->toUtc('2026-07-15', "{$hour}:{$minute}")->addMinutes(5),
            ]);
        }

        $start = microtime(true);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '08:00', '20:00')
        );

        $ms = (microtime(true) - $start) * 1000;

        // Solapa con las 200. El motor las reporta todas: cada una es un choque real.
        $this->assertGreaterThan(100, $result->violations->count());
        $this->assertLessThan(2000, $ms, 'Validar contra 200 solapes tarda demasiado.');
    }

    // ─────────── SOFT DELETES CRUZADOS ───────────

    #[Test]
    public function una_empresa_borrada_no_deja_de_ocupar_a_la_persona(): void
    {
        // Las horas se trabajaron y el cuerpo estuvo allí. Borrar la empresa no puede
        // ser un truco para liberar a alguien.
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria, $this->makeProfile($barA));
        $enB = $this->makeEmployment($barB, $maria, $this->makeProfile($barB));

        $posA = $this->makePosition($barA);
        $posB = $this->makePosition($barB);
        $enB->positions()->attach($posB);

        $this->assign($enA, $posA, '2026-07-15', '09:00', '17:00');

        $barA->delete(); // soft delete

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB->fresh(), $posB, '2026-07-15', '10:00', '14:00')
        );

        $this->assertTrue(
            $result->has(RuleCode::Overlap),
            'La empresa borrada deja de ocupar a la persona: eso es un agujero.',
        );
    }

    #[Test]
    public function borrar_el_perfil_afloja_los_limites_en_silencio_pero_el_motor_lo_dice(): void
    {
        // Los perfiles NO tienen soft delete (son catálogo, se retiran con is_active).
        // Si alguien lo borra de verdad, la FK pone profile_id a NULL y el contrato se
        // queda SIN LÍMITES. Es un aflojamiento silencioso... salvo porque el motor emite
        // el aviso de "contrato sin condiciones definidas". Esa es su red.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_minutes_week' => 60]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $antes = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );
        $this->assertTrue($antes->has(RuleCode::HourLimit));

        $profile->delete();

        $despues = app(AssignmentValidator::class)->validate(
            $this->draft($employment->fresh(), $position, '2026-07-15', '09:00', '17:00')
        );

        $this->assertFalse($despues->has(RuleCode::HourLimit), 'Sin perfil no hay límites: coherente.');
        $this->assertTrue(
            $despues->has(RuleCode::MissingProfile),
            'Pero el aflojamiento NO puede ser silencioso.',
        );
    }

    // ─────────── COBERTURA DEGENERADA ───────────

    #[Test]
    public function un_calendario_sin_requisitos_ni_una_empresa_sin_empleados_revientan_nada(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user); // sin un solo empleado
        $calendar = $this->makeCalendar($company);

        $report = app(CoverageCalculator::class)->forCalendar(
            $calendar,
            new TimeWindow(CarbonImmutable::parse('2026-07-13'), CarbonImmutable::parse('2026-07-19')),
        );

        $this->assertCount(0, $report->segments);
        $this->assertCount(0, $report->conflicts);
        $this->assertTrue($report->isFullyCovered());
    }

    #[Test]
    public function un_turno_duplicado_exacto_es_imposible(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company));
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );

        $this->assertTrue($result->has(RuleCode::Overlap));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function un_negocio_cerrado_en_invierno_no_pide_cobertura(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $calendar = $this->makeCalendar($company);
        $barra = $this->makePosition($company, 'Barra');

        $employment = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company));
        $employment->positions()->attach($barra);

        // Solo hay demanda de junio a septiembre.
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '20:00', 3,
            effectiveFrom: '2026-06-01', effectiveTo: '2026-09-30');

        $verano = app(CoverageCalculator::class)->forCalendar($calendar,
            new TimeWindow(CarbonImmutable::parse('2026-07-15'), CarbonImmutable::parse('2026-07-15')));

        $invierno = app(CoverageCalculator::class)->forCalendar($calendar,
            new TimeWindow(CarbonImmutable::parse('2026-01-15'), CarbonImmutable::parse('2026-01-15')));

        $this->assertCount(1, $verano->gaps());
        $this->assertCount(0, $invierno->gaps(), 'El chiringuito cerrado pide gente en enero.');
    }

    #[Test]
    public function el_cupo_no_se_come_a_si_mismo_al_revalidar_una_ausencia_existente(): void
    {
        // Trampa clásica: al re-validar una ausencia ya guardada, si no se excluye a sí
        // misma, sus propios días se cuentan DOS veces y salta un falso incumplimiento.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 5]));

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $absence = $this->addAbsence($person, $vacaciones, '2026-07-13', '2026-07-17', $employment); // 5 laborables

        $result = app(AbsenceValidator::class)->validate(
            AbsenceDraft::fromAbsence($absence->fresh())
        );

        $this->assertFalse(
            $result->has(RuleCode::LeaveQuota),
            'La ausencia se está contando a sí misma: 5 + 5 = 10 sobre un cupo de 5. Aviso falso.',
        );
    }

    #[Test]
    public function el_leave_quota_recorta_bien_una_ausencia_que_desborda_la_ventana(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $this->makeProfile($company));

        // Ausencia de todo julio, ventana de una sola semana.
        $dias = app(LeaveQuota::class)->daysConsumedWithin(
            $employment,
            CarbonImmutable::parse('2026-07-01'),
            CarbonImmutable::parse('2026-07-31'),
            new TimeWindow(CarbonImmutable::parse('2026-07-13'), CarbonImmutable::parse('2026-07-19')),
        );

        $this->assertSame(5, $dias, 'El recorte a la ventana debe dar los 5 laborables de esa semana.');
    }
}
