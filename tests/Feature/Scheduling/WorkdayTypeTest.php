<?php

namespace Tests\Feature\Scheduling;

use App\Enums\RuleCode;
use App\Enums\WorkdayType;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/** El tercer parámetro muerto: el perfil dice qué tipo de jornada admite. */
class WorkdayTypeTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(WorkdayType $type): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['workday_type' => $type]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        return compact('user', 'company', 'employment', 'position');
    }

    #[Test]
    public function un_perfil_de_jornada_continua_incumple_si_le_meten_una_partida(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Continuous);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        // Un segundo turno el mismo work_date convierte la jornada en partida.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '17:00', '21:00')
        );

        $this->assertTrue($result->has(RuleCode::WorkdayType));
        $this->assertTrue($result->isPossible(), 'La jornada partida AVISA, pero deja colocar.');
    }

    #[Test]
    public function un_perfil_de_jornada_continua_no_dice_nada_con_un_solo_turno(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Continuous);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );

        $this->assertTrue($result->isClean());
    }

    #[Test]
    public function un_perfil_de_jornada_continua_no_se_queja_de_turnos_en_dias_distintos(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Continuous);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        // Otro día: sigue siendo una jornada continua cada uno.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-16', '17:00', '21:00')
        );

        $this->assertFalse($result->has(RuleCode::WorkdayType));
    }

    #[Test]
    public function permitir_partida_no_es_obligar_a_partida(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Split);

        // Un solo turno con un perfil que PERMITE partida: no hay nada que avisar.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '09:00', '17:00')
        );

        $this->assertTrue($result->isClean());
    }

    #[Test]
    public function un_perfil_que_permite_partida_no_se_queja_de_una_partida(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Split);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '17:00', '21:00')
        );

        $this->assertFalse($result->has(RuleCode::WorkdayType));
    }

    #[Test]
    public function el_perfil_any_no_valida_nada(): void
    {
        ['employment' => $employment, 'position' => $position] = $this->mundo(WorkdayType::Any);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '17:00', '21:00')
        );

        $this->assertFalse($result->has(RuleCode::WorkdayType));
    }

    #[Test]
    public function el_turno_de_otra_empresa_no_rompe_el_perfil_continuo_de_esta(): void
    {
        // El workday_type es un parámetro del PERFIL, y el perfil es del CONTRATO. Si
        // María hace la mañana en el Bar A y la tarde en el Bar B, el Bar A le ha dado
        // una jornada continua: su perfil no está roto por un turno que le dio otra
        // empresa y que no controla. Ese caso ya lo cubre el aviso de SharedWorkday.
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria, $this->makeProfile($barA, ['workday_type' => WorkdayType::Continuous]));
        $enB = $this->makeEmployment($barB, $maria, $this->makeProfile($barB, ['workday_type' => WorkdayType::Continuous]));

        $barraA = $this->makePosition($barA);
        $cocinaB = $this->makePosition($barB);
        $enB->positions()->attach($cocinaB);

        $this->assign($enA, $barraA, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB, $cocinaB, '2026-07-15', '17:00', '21:00')
        );

        $this->assertFalse($result->has(RuleCode::WorkdayType));
        $this->assertTrue($result->has(RuleCode::SharedWorkday), 'Pero el encargado tiene que enterarse igualmente.');
    }
}
