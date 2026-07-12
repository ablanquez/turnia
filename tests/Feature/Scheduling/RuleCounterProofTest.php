<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\Rules\AvailabilityRule;
use App\Services\Scheduling\Validation\Rules\ContractActiveRule;
use App\Services\Scheduling\Validation\Rules\EligibilityRule;
use App\Services\Scheduling\Validation\Rules\HourLimitRule;
use App\Services\Scheduling\Validation\Rules\IntervalSanityRule;
use App\Services\Scheduling\Validation\Rules\MinimumRestRule;
use App\Services\Scheduling\Validation\Rules\OverlapRule;
use App\Services\Scheduling\Validation\Rules\SharedWorkdayRule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * CONTRAPRUEBA: demostrar que cada protección SIRVE.
 *
 * Para cada regla, se monta el dato inválido y se comprueba dos cosas:
 *   1. Con la regla puesta, salta.
 *   2. Con la regla QUITADA, el dato inválido pasa sin que nadie diga nada.
 *
 * Si al quitar la regla el test siguiera en verde, es que el test no probaba nada.
 */
class RuleCounterProofTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    /** Comprueba que la regla salta, y que sin ella el dato inválido pasa. */
    private function assertRuleProtects(string $ruleClass, RuleCode $code, callable $buildDraft): void
    {
        $draft = $buildDraft();

        $conRegla = app(AssignmentValidator::class)->validate($draft);
        $this->assertTrue(
            $conRegla->has($code),
            "Con {$ruleClass} puesta, la violación {$code->value} debería saltar.",
        );

        $sinRegla = app(AssignmentValidator::class)->without($ruleClass)->validate($draft);
        $this->assertFalse(
            $sinRegla->has($code),
            "Al quitar {$ruleClass} la violación sigue apareciendo: la protección no era esa regla.",
        );
    }

    #[Test]
    public function sin_la_regla_de_solape_maria_puede_estar_en_dos_sitios_a_la_vez(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $this->assertRuleProtects(
            OverlapRule::class,
            RuleCode::Overlap,
            fn () => $this->draft($employment, $position, '2026-07-15', '10:00', '14:00'),
        );
    }

    #[Test]
    public function sin_la_regla_de_descanso_puede_encadenar_turnos_sin_dormir(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['min_rest_minutes_between_shifts' => 720]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00');

        $this->assertRuleProtects(
            MinimumRestRule::class,
            RuleCode::MinimumRest,
            fn () => $this->draft($employment, $position, '2026-07-16', '02:00', '06:00'), // 4h de descanso
        );
    }

    #[Test]
    public function sin_la_regla_de_limites_puede_hacer_100_horas_a_la_semana(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_minutes_week' => 2400]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        foreach (['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'] as $day) {
            $this->assign($employment, $position, $day, '08:00', '20:00'); // 12h/día = 60h
        }

        $this->assertRuleProtects(
            HourLimitRule::class,
            RuleCode::HourLimit,
            fn () => $this->draft($employment, $position, '2026-07-18', '08:00', '20:00'),
        );
    }

    #[Test]
    public function sin_la_regla_de_disponibilidad_puede_trabajar_estando_de_baja(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $maria = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $maria);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person);
        $this->addAbsence($maria, $baja, '2026-07-13', endsOn: null);

        $this->assertRuleProtects(
            AvailabilityRule::class,
            RuleCode::Unavailable,
            fn () => $this->draft($employment, $position, '2026-07-15', '09:00', '17:00'),
        );
    }

    #[Test]
    public function sin_la_regla_de_elegibilidad_el_de_almacen_acaba_en_la_barra(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $barra = $this->makePosition($company, 'Barra');
        // Sin attach: no está cualificado.

        $this->assertRuleProtects(
            EligibilityRule::class,
            RuleCode::Eligibility,
            fn () => $this->draft($employment, $barra, '2026-07-15', '09:00', '17:00'),
        );
    }

    #[Test]
    public function sin_la_regla_de_intervalo_se_cuela_un_turno_de_duracion_negativa(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assertRuleProtects(
            IntervalSanityRule::class,
            RuleCode::InvalidInterval,
            fn () => $this->draft($employment, $position, '2026-07-15', '17:00', '09:00'),
        );
    }

    #[Test]
    public function sin_la_regla_del_dia_compartido_nadie_se_entera_de_que_encadena_dos_bares(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria);
        $enB = $this->makeEmployment($barB, $maria);

        $barraA = $this->makePosition($barA);
        $cocinaB = $this->makePosition($barB);
        $enB->positions()->attach($cocinaB);

        $this->assign($enA, $barraA, '2026-07-15', '09:00', '13:00');

        $this->assertRuleProtects(
            SharedWorkdayRule::class,
            RuleCode::SharedWorkday,
            fn () => $this->draft($enB, $cocinaB, '2026-07-15', '17:00', '21:00'),
        );
    }

    #[Test]
    public function sin_la_regla_de_vigencia_se_asigna_a_un_contrato_muerto(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), null, [
            'ends_on' => '2026-01-31',
        ]);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assertRuleProtects(
            ContractActiveRule::class,
            RuleCode::ContractInactive,
            fn () => $this->draft($employment, $position, '2026-07-15', '09:00', '17:00'),
        );
    }
}
