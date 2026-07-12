<?php

namespace Tests\Feature\Stress;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\Recurrence;
use App\Enums\RuleCode;
use App\Services\Scheduling\CoverageCalculator;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use App\Services\Scheduling\ViolationReport;
use App\Services\Scheduling\WindowResolver;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * CAZA DEL SILENCIO FALSO.
 *
 * Un aviso falso se ve. Un silencio falso, no. Aquí se busca lo segundo: sitios donde
 * el motor DEJA DE MIRAR y por tanto no puede avisar de nada.
 */
class SilentFalseHuntTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function el_informe_de_incumplimientos_ve_los_conceptos_horarios_invalidados_por_una_baja(): void
    {
        // SILENCIO FALSO SOSPECHADO:
        // El ViolationReport re-valida ASIGNACIONES. ¿Y los conceptos horarios?
        // Si María tiene una hora médica el jueves y luego se registra una baja que
        // cubre ese jueves, esa hora médica pasa a ser inválida (no puedes ir al médico
        // "por trabajo" estando de baja: el motor lo prohíbe al crearla). Pero si nadie
        // la re-valida nunca, la contradicción se queda ahí para siempre.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');
        $entry = $this->addConcept($employment, $medica, '2026-07-16', '10:00', '12:00');
        $this->assign($employment, $position, '2026-07-17', '09:00', '17:00');

        // El concepto era válido al crearlo.
        $this->assertTrue(
            app(ConceptEntryValidator::class)->validate(ConceptEntryDraft::fromEntry($entry))->isClean()
        );

        // Ahora cae de baja desde el 15.
        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja');
        $this->addAbsence($person, $baja, '2026-07-15', endsOn: null);

        // La hora médica ha quedado invalidada: si se intentara crear ahora, sería
        // IMPOSIBLE.
        $this->assertTrue(
            app(ConceptEntryValidator::class)->validate(ConceptEntryDraft::fromEntry($entry->fresh()))
                ->has(RuleCode::Unavailable),
            'La hora médica dentro de una baja debería ser inválida.',
        );

        // ¿Y el informe de la semana lo dice?
        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-16'));
        $report = app(ViolationReport::class)->forCompany($company, $window);

        $reportaConceptos = $report->contains(
            fn ($row) => $row->kind === 'concept_entry' && $row->result->has(RuleCode::Unavailable)
        );

        $this->assertTrue(
            $reportaConceptos,
            'SILENCIO FALSO: el informe re-valida las asignaciones pero NO los conceptos horarios. '.
            'Una hora médica invalidada por una baja no aparece en ninguna parte.',
        );
    }

    #[Test]
    public function un_puesto_que_nadie_puede_cubrir_se_denuncia(): void
    {
        // SILENCIO FALSO SOSPECHADO:
        // Se declara que hacen falta 2 de "Sumiller" los sábados... y NADIE en la
        // plantilla está cualificado para ese puesto. El calculador dirá "faltan 2",
        // pero no dirá lo que de verdad pasa: que ese hueco es INCUBRIBLE. El encargado
        // buscará a quién poner y no encontrará a nadie, sin entender por qué.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $calendar = $this->makeCalendar($company);

        $barra = $this->makePosition($company, 'Barra');
        $sumiller = $this->makePosition($company, 'Sumiller');

        // Hay gente, y está cualificada para Barra. Nadie para Sumiller.
        for ($i = 0; $i < 3; $i++) {
            $employment = $this->makeEmployment($company, $this->makePerson($user));
            $employment->positions()->attach($barra);
        }

        $this->makeRequirement($calendar, $sumiller, Recurrence::Daily, '12:00', '16:00', 2);

        $report = app(CoverageCalculator::class)->forCalendar(
            $calendar,
            app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-15')),
        );

        $this->assertTrue(
            $report->conflicts->contains(fn ($v) => $v->code === RuleCode::UncoverablePosition),
            'SILENCIO FALSO: se pide cobertura de un puesto que NADIE puede cubrir y el motor '.
            'solo dice "faltan 2", como si fuera un hueco normal.',
        );
    }
}
