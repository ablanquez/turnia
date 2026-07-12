<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Enums\WorkdayType;
use App\Services\Scheduling\Validation\AbsenceValidator;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use App\Services\Scheduling\Validation\Rules\Absence\AbsenceOverlapRule;
use App\Services\Scheduling\Validation\Rules\Absence\ContractActiveRule;
use App\Services\Scheduling\Validation\Rules\Absence\LeaveQuotaRule;
use App\Services\Scheduling\Validation\Rules\Absence\OrphanWarningRule;
use App\Services\Scheduling\Validation\Rules\Assignment\WorkdayTypeRule;
use App\Services\Scheduling\Validation\Rules\Concept\AvailabilityRule;
use App\Services\Scheduling\Validation\Rules\Concept\OverlapRule;
use App\Services\Scheduling\Validation\Rules\Concept\OvertimeLimitRule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * CONTRAPRUEBA de las reglas nuevas.
 *
 * Para cada una: con la regla puesta salta, y sin ella el dato inválido PASA sin que
 * nadie diga nada. Si al quitarla el test siguiera en verde, el test no probaba nada.
 */
class NewRulesCounterProofTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function sin_la_regla_de_extras_se_pueden_hacer_500_horas_extra_con_un_tope_de_10(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_overtime_minutes_year' => 600]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');
        $this->addConcept($employment, $extra, '2026-07-10', '12:00', '22:00'); // 10h: tope agotado

        $draft = $this->conceptDraft($employment, $extra, '2026-07-15', '12:00', '22:00');

        $this->assertTrue(
            app(ConceptEntryValidator::class)->validate($draft)->has(RuleCode::OvertimeLimit),
        );
        $this->assertFalse(
            app(ConceptEntryValidator::class)->without(OvertimeLimitRule::class)->validate($draft)
                ->has(RuleCode::OvertimeLimit),
            'Sin OvertimeLimitRule el tope de extras vuelve a estar muerto.',
        );
    }

    #[Test]
    public function sin_la_regla_de_cupo_se_pueden_coger_100_dias_de_vacaciones(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 5]));

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment,
            'consumes_leave_quota' => true,
        ]);

        $draft = $this->absenceDraft($person, $vacaciones, '2026-07-01', '2026-09-30', $employment);

        $this->assertTrue(app(AbsenceValidator::class)->validate($draft)->has(RuleCode::LeaveQuota));
        $this->assertFalse(
            app(AbsenceValidator::class)->without(LeaveQuotaRule::class)->validate($draft)->has(RuleCode::LeaveQuota),
            'Sin LeaveQuotaRule el cupo de vacaciones vuelve a estar muerto.',
        );
    }

    #[Test]
    public function sin_la_regla_de_jornada_se_le_cuela_una_partida_a_un_perfil_continuo(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['workday_type' => WorkdayType::Continuous]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        $draft = $this->draft($employment, $position, '2026-07-15', '17:00', '21:00');

        $this->assertTrue(app(AssignmentValidator::class)->validate($draft)->has(RuleCode::WorkdayType));
        $this->assertFalse(
            app(AssignmentValidator::class)->without(WorkdayTypeRule::class)->validate($draft)
                ->has(RuleCode::WorkdayType),
            'Sin WorkdayTypeRule el workday_type vuelve a estar muerto.',
        );
    }

    #[Test]
    public function sin_la_regla_de_solape_de_conceptos_se_mete_una_hora_medica_encima_de_un_turno(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');
        $draft = $this->conceptDraft($employment, $medica, '2026-07-15', '10:00', '12:00');

        $this->assertTrue(app(ConceptEntryValidator::class)->validate($draft)->has(RuleCode::Overlap));
        $this->assertFalse(
            app(ConceptEntryValidator::class)->without(OverlapRule::class)->validate($draft)->has(RuleCode::Overlap),
            'Sin la regla, el solape solo se ve en una dirección: el hueco que veníamos a cerrar.',
        );
    }

    #[Test]
    public function sin_la_regla_de_disponibilidad_se_registra_una_hora_medica_en_vacaciones(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);

        $vacaciones = $this->makeAbsenceType($company, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones');
        $this->addAbsence($person, $vacaciones, '2026-07-13', '2026-07-19', $employment);

        $medica = $this->makeConceptType($company, Computation::Adds);
        $draft = $this->conceptDraft($employment, $medica, '2026-07-15', '10:00', '12:00');

        $this->assertTrue(app(ConceptEntryValidator::class)->validate($draft)->has(RuleCode::Unavailable));
        $this->assertFalse(
            app(ConceptEntryValidator::class)->without(AvailabilityRule::class)->validate($draft)
                ->has(RuleCode::Unavailable),
        );
    }

    #[Test]
    public function sin_la_regla_de_solape_de_ausencias_se_apilan_bajas_sobre_bajas(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja');
        $this->addAbsence($person, $baja, '2026-07-01', endsOn: null);

        $draft = $this->absenceDraft($person, $baja, '2026-07-15', '2026-07-20');

        $this->assertTrue(app(AbsenceValidator::class)->validate($draft)->has(RuleCode::DuplicateAbsence));
        $this->assertFalse(
            app(AbsenceValidator::class)->without(AbsenceOverlapRule::class)->validate($draft)
                ->has(RuleCode::DuplicateAbsence),
        );
    }

    #[Test]
    public function sin_la_regla_de_vigencia_se_cogen_vacaciones_en_un_contrato_muerto(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person,
            $this->makeProfile($company, ['annual_leave_days' => 22]),
            ['ends_on' => '2026-01-31']);

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment,
            'consumes_leave_quota' => true,
        ]);

        $draft = $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment);

        $this->assertTrue(app(AbsenceValidator::class)->validate($draft)->has(RuleCode::ContractInactive));
        $this->assertFalse(
            app(AbsenceValidator::class)->without(ContractActiveRule::class)->validate($draft)
                ->has(RuleCode::ContractInactive),
            'Sin la regla, las vacaciones en un contrato terminado vuelven a pasar en silencio.',
        );
    }

    #[Test]
    public function sin_la_regla_de_huerfanas_la_baja_deja_turnos_al_descubierto_en_silencio(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-07-16', '09:00', '17:00');

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja');
        $draft = $this->absenceDraft($person, $baja, '2026-07-15', endsOn: null);

        $this->assertTrue(app(AbsenceValidator::class)->validate($draft)->has(RuleCode::OrphanedAssignments));
        $this->assertFalse(
            app(AbsenceValidator::class)->without(OrphanWarningRule::class)->validate($draft)
                ->has(RuleCode::OrphanedAssignments),
        );
    }
}
