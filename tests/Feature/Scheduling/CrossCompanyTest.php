<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Enums\Severity;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * DONDE MÁS FÁCIL SE ROMPE EL MOTOR.
 *
 * María trabaja en el Bar A y en el Bar B, del mismo empresario. Su cuerpo es uno
 * solo: no descansa el doble por tener dos contratos, ni puede estar en dos sitios
 * a la vez. Si alguna de estas comprobaciones se queda dentro de una empresa, el
 * motor está roto.
 */
class CrossCompanyTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function dosBares(): array
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        // El perfil del Bar B exige 12h de descanso entre turnos.
        $perfilA = $this->makeProfile($barA, ['min_rest_minutes_between_shifts' => 600]);
        $perfilB = $this->makeProfile($barB, ['min_rest_minutes_between_shifts' => 720]);

        $enA = $this->makeEmployment($barA, $maria, $perfilA);
        $enB = $this->makeEmployment($barB, $maria, $perfilB);

        $barraA = $this->makePosition($barA, 'Barra A');
        $cocinaB = $this->makePosition($barB, 'Cocina B');

        $enA->positions()->attach($barraA);
        $enB->positions()->attach($cocinaB);

        return compact('user', 'maria', 'barA', 'barB', 'enA', 'enB', 'barraA', 'cocinaB');
    }

    #[Test]
    public function cierra_el_bar_a_a_las_2_y_entra_en_el_bar_b_a_las_9_solo_descansa_7_horas(): void
    {
        ['enA' => $enA, 'enB' => $enB, 'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        // Cierra el Bar A a las 2:00 de la madrugada del día 16.
        $this->assign($enA, $barraA, '2026-07-15', '18:00', '02:00', endDate: '2026-07-16');

        // Y pretende entrar en el Bar B a las 9:00 del día 16. Descanso: 7h.
        $draft = $this->draft($enB, $cocinaB, '2026-07-16', '09:00', '17:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::MinimumRest), 'El descanso NO cruzó la frontera de la empresa.');

        $violation = $result->violations->first(fn ($v) => $v->code === RuleCode::MinimumRest);

        $this->assertSame(420, $violation->context['rest_minutes']);      // 7h reales
        $this->assertSame(720, $violation->context['required_minutes']);  // 12h que pide el Bar B
    }

    #[Test]
    public function no_puede_estar_a_las_10_en_el_bar_a_y_a_las_10_en_el_bar_b(): void
    {
        ['enA' => $enA, 'enB' => $enB, 'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        $this->assign($enA, $barraA, '2026-07-15', '10:00', '14:00');

        $draft = $this->draft($enB, $cocinaB, '2026-07-15', '10:00', '14:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::Overlap), 'El solape NO cruzó la frontera de la empresa.');
        $this->assertFalse($result->isPossible(), 'Estar en dos bares a la vez debería ser IMPOSIBLE.');
    }

    #[Test]
    public function la_baja_de_persona_bloquea_en_los_dos_bares(): void
    {
        ['maria' => $maria, 'barA' => $barA, 'enA' => $enA, 'enB' => $enB,
            'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        $baja = $this->makeAbsenceType($barA, AbsenceScope::Person, name: 'Baja laboral');
        $this->addAbsence($maria, $baja, '2026-07-13', endsOn: null); // abierta

        $enBarA = app(AssignmentValidator::class)->validate($this->draft($enA, $barraA, '2026-07-15', '09:00', '17:00'));
        $enBarB = app(AssignmentValidator::class)->validate($this->draft($enB, $cocinaB, '2026-07-15', '09:00', '17:00'));

        $this->assertTrue($enBarA->has(RuleCode::Unavailable));
        $this->assertTrue($enBarB->has(RuleCode::Unavailable), 'La baja se quedó encerrada en una sola empresa.');
    }

    #[Test]
    public function las_vacaciones_del_bar_a_no_le_impiden_ir_al_bar_b(): void
    {
        ['maria' => $maria, 'barA' => $barA, 'enA' => $enA, 'enB' => $enB,
            'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        $vacaciones = $this->makeAbsenceType($barA, AbsenceScope::Employment, name: 'Vacaciones');
        $this->addAbsence($maria, $vacaciones, '2026-07-13', '2026-07-19', employment: $enA);

        $enBarA = app(AssignmentValidator::class)->validate($this->draft($enA, $barraA, '2026-07-15', '09:00', '17:00'));
        $enBarB = app(AssignmentValidator::class)->validate($this->draft($enB, $cocinaB, '2026-07-15', '09:00', '17:00'));

        $this->assertTrue($enBarA->has(RuleCode::Unavailable), 'Debería estar de vacaciones en el Bar A.');
        $this->assertFalse($enBarB->has(RuleCode::Unavailable), 'Las vacaciones del Bar A se colaron al Bar B.');
    }

    #[Test]
    public function la_hora_medica_registrada_en_el_bar_a_le_impide_trabajar_en_el_bar_b(): void
    {
        ['barA' => $barA, 'enA' => $enA, 'enB' => $enB, 'cocinaB' => $cocinaB] = $this->dosBares();

        $medica = $this->makeConceptType($barA, Computation::Adds, 'Hora médica');
        $this->addConcept($enA, $medica, '2026-07-15', '10:00', '12:00');

        // Físicamente está en el médico: da igual en qué empresa esté registrado.
        $draft = $this->draft($enB, $cocinaB, '2026-07-15', '09:00', '14:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertTrue($result->has(RuleCode::Overlap), 'El concepto de la otra empresa no bloqueó nada.');
    }

    #[Test]
    public function trabajar_el_mismo_dia_en_dos_empresas_avisa_aunque_no_incumpla(): void
    {
        ['enA' => $enA, 'enB' => $enB, 'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        // Mañana en el Bar A, tarde en el Bar B. No solapan, y el descanso no se
        // exige dentro de la misma jornada. Nadie incumple nada... pero cada
        // encargado cree que le está dando una partida entera, y ninguno sabe que
        // María está encadenando dos.
        $this->assign($enA, $barraA, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB, $cocinaB, '2026-07-15', '17:00', '21:00')
        );

        $this->assertTrue($result->has(RuleCode::SharedWorkday));
        $this->assertTrue($result->isPossible(), 'No es imposible: no está en dos sitios a la vez.');
        $this->assertCount(0, $result->breaches(), 'No incumple nada: es informativo.');
        $this->assertCount(1, $result->notices());

        $notice = $result->notices()->first();
        $this->assertSame(Severity::Notice, $notice->severity);
        $this->assertStringContainsString('Bar A', $notice->message);
    }

    #[Test]
    public function la_jornada_partida_dentro_de_una_sola_empresa_no_dispara_el_aviso(): void
    {
        ['enA' => $enA, 'barraA' => $barraA] = $this->dosBares();

        // Contrapunto: una partida normal, en un solo bar. Silencio absoluto.
        $this->assign($enA, $barraA, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enA, $barraA, '2026-07-15', '17:00', '21:00')
        );

        $this->assertFalse($result->has(RuleCode::SharedWorkday));
        $this->assertTrue($result->isClean());
    }

    #[Test]
    public function trabajar_en_dos_empresas_en_dias_distintos_no_dispara_el_aviso(): void
    {
        ['enA' => $enA, 'enB' => $enB, 'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        $this->assign($enA, $barraA, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB, $cocinaB, '2026-07-17', '09:00', '13:00')
        );

        $this->assertFalse($result->has(RuleCode::SharedWorkday));
    }

    #[Test]
    public function los_topes_de_horas_si_son_por_contrato_y_no_se_suman_entre_empresas(): void
    {
        ['maria' => $maria, 'barA' => $barA, 'barB' => $barB,
            'enA' => $enA, 'enB' => $enB, 'barraA' => $barraA, 'cocinaB' => $cocinaB] = $this->dosBares();

        // Contrapunto de los anteriores: el descanso y el solape son de la PERSONA,
        // pero el tope de horas es del CONTRATO. Trabajar 10h en el Bar A no consume
        // el cupo del Bar B: son dos contratos distintos.
        $enA->profile->update(['max_minutes_week' => 600]);  // 10h
        $enB->profile->update(['max_minutes_week' => 600]);  // 10h

        $this->assign($enA, $barraA, '2026-07-15', '09:00', '19:00'); // 10h en el Bar A: tope justo

        // 10h en el Bar B, en otro día para no chocar con el descanso ni el solape.
        $draft = $this->draft($enB->fresh(), $cocinaB, '2026-07-17', '09:00', '19:00');

        $result = app(AssignmentValidator::class)->validate($draft);

        $this->assertFalse($result->has(RuleCode::HourLimit), 'Las horas del Bar A se colaron en el tope del Bar B.');
    }
}
