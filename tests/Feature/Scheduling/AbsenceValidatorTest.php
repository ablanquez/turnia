<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AbsenceValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class AbsenceValidatorTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 22]));
        $position = $this->makePosition($company);

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja laboral');

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment,
            'consumes_leave_quota' => true,
        ]);

        return compact('user', 'company', 'person', 'employment', 'position', 'baja', 'vacaciones');
    }

    // ─────────── SOLAPES ───────────

    #[Test]
    public function una_baja_abierta_solapa_con_todo_lo_que_venga_despues(): void
    {
        ['person' => $person, 'employment' => $employment, 'baja' => $baja, 'vacaciones' => $vacaciones] = $this->mundo();

        // Baja abierta desde enero, sin fecha de fin.
        $this->addAbsence($person, $baja, '2026-01-15', endsOn: null);

        // Vacaciones en julio, seis meses después.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment)
        );

        $this->assertTrue($result->has(RuleCode::AbsenceOverlap), 'La baja abierta no está solapando hacia el futuro.');
    }

    #[Test]
    public function la_baja_sobre_las_vacaciones_se_puede_registrar_y_avisa_de_los_dias_pisados(): void
    {
        // EL CASO QUE NO SE PUEDE BLOQUEAR. En España, si te pones enfermo durante las
        // vacaciones, la baja las interrumpe y esos días se recuperan. Si el motor lo
        // marcara imposible, el gestor borraría las vacaciones a mano para poder meter
        // la baja: el dato corrupto que queríamos evitar.
        ['person' => $person, 'employment' => $employment, 'baja' => $baja, 'vacaciones' => $vacaciones] = $this->mundo();

        // Vacaciones del lunes 13 al viernes 17 de julio.
        $this->addAbsence($person, $vacaciones, '2026-07-13', '2026-07-17', $employment);

        // Se pone enferma el miércoles 15. Baja abierta.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $baja, '2026-07-15', endsOn: null)
        );

        $this->assertTrue($result->isPossible(), 'La baja sobre vacaciones DEBE poder registrarse.');
        $this->assertTrue($result->has(RuleCode::AbsenceOverlap));

        // Y avisa de cuántos días laborables quedan pisados: 15, 16 y 17 = 3.
        $this->assertTrue($result->has(RuleCode::LeaveOverlappedByBlocking));

        $aviso = $result->violations->first(fn ($v) => $v->code === RuleCode::LeaveOverlappedByBlocking);
        $this->assertSame(3, $aviso->context['overlapped_working_days']);

        // Pero NO los devuelve al cupo por su cuenta: eso es una decisión laboral del
        // empresario. Turnia informa; el humano decide.
    }

    #[Test]
    public function dos_ausencias_del_mismo_tipo_solapadas_son_imposibles(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo();

        $this->addAbsence($person, $vacaciones, '2026-07-13', '2026-07-17', $employment);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-15', '2026-07-20', $employment)
        );

        // Dos vacaciones solapadas no significan nada.
        $this->assertTrue($result->has(RuleCode::DuplicateAbsence));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function una_ausencia_que_contiene_enteramente_a_otra_solapa(): void
    {
        ['person' => $person, 'employment' => $employment, 'baja' => $baja, 'vacaciones' => $vacaciones] = $this->mundo();

        // Vacaciones cortas dentro de una baja larga.
        $this->addAbsence($person, $vacaciones, '2026-07-15', '2026-07-16', $employment);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $baja, '2026-07-01', '2026-07-31')
        );

        $this->assertTrue($result->has(RuleCode::AbsenceOverlap));
    }

    #[Test]
    public function una_ausencia_de_un_solo_dia_funciona(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo();

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-15', '2026-07-15', $employment)
        );

        $this->assertTrue($result->isClean());
    }

    #[Test]
    public function la_baja_de_persona_choca_con_las_vacaciones_de_cualquiera_de_sus_contratos(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria, $this->makeProfile($barA, ['annual_leave_days' => 22]));
        $enB = $this->makeEmployment($barB, $maria, $this->makeProfile($barB, ['annual_leave_days' => 22]));

        $vacA = $barA->absenceTypes()->create([
            'name' => 'Vacaciones A', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $this->addAbsence($maria, $vacA, '2026-07-13', '2026-07-17', $enA);

        // La baja es de la PERSONA: alcanza a los dos contratos, así que choca con las
        // vacaciones del Bar A aunque se registre desde el Bar B.
        $bajaB = $this->makeAbsenceType($barB, AbsenceScope::Person, Computation::Blocks, 'Baja');

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($maria, $bajaB, '2026-07-15', '2026-07-20')
        );

        $this->assertTrue($result->has(RuleCode::AbsenceOverlap));
        $this->assertTrue($result->has(RuleCode::LeaveOverlappedByBlocking));
    }

    #[Test]
    public function las_vacaciones_de_un_contrato_no_chocan_con_las_del_otro(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user);
        $barB = $this->makeCompany($user);

        $enA = $this->makeEmployment($barA, $maria, $this->makeProfile($barA, ['annual_leave_days' => 22]));
        $enB = $this->makeEmployment($barB, $maria, $this->makeProfile($barB, ['annual_leave_days' => 22]));

        $vacA = $this->makeAbsenceType($barA, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones A');
        $vacB = $this->makeAbsenceType($barB, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones B');

        $this->addAbsence($maria, $vacA, '2026-07-13', '2026-07-17', $enA);

        // Coger vacaciones en el Bar B las mismas fechas es raro, pero no es asunto del
        // Bar B: son contratos independientes.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($maria, $vacB, '2026-07-13', '2026-07-17', $enB)
        );

        $this->assertFalse(
            $result->has(RuleCode::AbsenceOverlap),
            'Las vacaciones del Bar A se están metiendo en las del Bar B.',
        );
    }

    // ─────────── RANGO CORRUPTO ───────────

    #[Test]
    public function una_ausencia_que_termina_antes_de_empezar_es_imposible(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo();

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-20', '2026-07-13', $employment)
        );

        $this->assertTrue($result->has(RuleCode::InvalidDateRange));
        $this->assertFalse($result->isPossible());
    }

    // ─────────── VIGENCIA DEL CONTRATO: LA ASIMETRÍA ───────────

    #[Test]
    public function no_se_pueden_coger_vacaciones_en_un_contrato_ya_terminado(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo();

        $employment->update(['ends_on' => '2026-01-31']);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment->fresh())
        );

        // Pedir vacaciones para julio en un contrato que acabó en enero no significa
        // nada. No es un incumplimiento de convenio: es un dato sin sentido.
        $this->assertTrue($result->has(RuleCode::ContractInactive));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function no_se_pueden_coger_vacaciones_antes_de_que_empiece_el_contrato(): void
    {
        ['company' => $company, 'person' => $person] = $this->mundo();

        $employment = $this->makeEmployment($company, $person,
            $this->makeProfile($company, ['annual_leave_days' => 22]),
            ['starts_on' => '2026-09-01']);

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones futuras', 'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
        ]);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment)
        );

        $this->assertTrue($result->has(RuleCode::ContractInactive));
    }

    #[Test]
    public function una_baja_de_persona_si_puede_sobrevivir_al_fin_del_contrato(): void
    {
        // LA ASIMETRÍA. Copiar la regla de las asignaciones a ciegas habría impedido
        // registrar bajas reales: te pones enfermo, tu contrato temporal termina, y la
        // baja sigue. Además, una baja de persona no tiene contrato del que comprobar
        // vigencia.
        ['person' => $person, 'employment' => $employment, 'baja' => $baja] = $this->mundo();

        $employment->update(['ends_on' => '2026-07-31']);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $baja, '2026-07-20', endsOn: null)
        );

        $this->assertFalse(
            $result->has(RuleCode::ContractInactive),
            'La baja de persona no puede depender de la vigencia de un contrato que ni tiene.',
        );
        $this->assertTrue($result->isPossible());
    }

    #[Test]
    public function unas_vacaciones_que_se_salen_por_el_final_del_contrato_son_imposibles(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo();

        // El contrato acaba el 15 de julio y las vacaciones llegan al 17.
        $employment->update(['ends_on' => '2026-07-15']);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment->fresh())
        );

        $this->assertTrue($result->has(RuleCode::ContractInactive));
    }

    // ─────────── HUÉRFANAS ───────────

    #[Test]
    public function registrar_la_baja_avisa_de_los_turnos_que_deja_al_descubierto(): void
    {
        ['person' => $person, 'employment' => $employment, 'position' => $position, 'baja' => $baja] = $this->mundo();

        $this->assign($employment, $position, '2026-07-16', '09:00', '17:00');
        $this->assign($employment, $position, '2026-07-17', '09:00', '17:00');
        $this->assign($employment, $position, '2026-07-10', '09:00', '17:00'); // antes de la baja

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $baja, '2026-07-15', endsOn: null)
        );

        $this->assertTrue($result->has(RuleCode::OrphanedAssignments));

        $aviso = $result->violations->first(fn ($v) => $v->code === RuleCode::OrphanedAssignments);
        $this->assertSame(2, $aviso->context['orphan_count'], 'El turno anterior a la baja no queda huérfano.');
        $this->assertTrue($result->isPossible(), 'El aviso de huérfanas no bloquea: informa.');
    }

    #[Test]
    public function una_ausencia_que_no_bloquea_no_deja_huerfanos(): void
    {
        ['company' => $company, 'person' => $person, 'employment' => $employment, 'position' => $position] = $this->mundo();

        $this->assign($employment, $position, '2026-07-16', '09:00', '17:00');

        // Un permiso que SUMA al contador no bloquea la disponibilidad.
        $permiso = $this->makeAbsenceType($company, AbsenceScope::Employment, Computation::Adds, 'Permiso retribuido');

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $permiso, '2026-07-15', '2026-07-20', $employment)
        );

        $this->assertFalse($result->has(RuleCode::OrphanedAssignments));
    }
}
