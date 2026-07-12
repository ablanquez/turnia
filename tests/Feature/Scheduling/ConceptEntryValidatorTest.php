<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class ConceptEntryValidatorTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(array $limits = []): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $profile = $this->makeProfile($company, $limits);
        $employment = $this->makeEmployment($company, $person, $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        return compact('user', 'company', 'person', 'profile', 'employment', 'position');
    }

    #[Test]
    public function un_concepto_limpio_no_dice_nada(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo();

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $medica, '2026-07-15', '10:00', '12:00')
        );

        $this->assertTrue($result->isClean());
    }

    // ─────────── LA DIRECCIÓN QUE FALTABA ───────────

    #[Test]
    public function una_hora_medica_encima_de_un_turno_ya_puesto_es_imposible(): void
    {
        // Hasta ahora el solape solo se veía al colocar la ASIGNACIÓN: se podía meter
        // una hora médica encima de un turno existente y nadie decía nada.
        ['company' => $company, 'employment' => $employment, 'position' => $position] = $this->mundo();

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $medica, '2026-07-15', '10:00', '12:00')
        );

        $this->assertTrue($result->has(RuleCode::Overlap));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function una_hora_medica_encima_de_un_turno_de_otra_empresa_tambien_es_imposible(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria);
        $enB = $this->makeEmployment($barB, $maria);

        $this->assign($enA, $this->makePosition($barA), '2026-07-15', '09:00', '17:00');

        $medica = $this->makeConceptType($barB, Computation::Adds, 'Hora médica');

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($enB, $medica, '2026-07-15', '10:00', '12:00')
        );

        $this->assertTrue($result->has(RuleCode::Overlap), 'El solape no cruzó la frontera de la empresa.');
    }

    #[Test]
    public function un_concepto_que_empieza_justo_al_acabar_el_turno_no_solapa(): void
    {
        ['company' => $company, 'employment' => $employment, 'position' => $position] = $this->mundo();

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $medica = $this->makeConceptType($company, Computation::Adds);

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $medica, '2026-07-15', '17:00', '18:00')
        );

        // Intervalos semiabiertos [inicio, fin), igual que en las asignaciones.
        $this->assertFalse($result->has(RuleCode::Overlap));
    }

    #[Test]
    public function no_se_puede_registrar_una_hora_medica_dentro_de_unas_vacaciones(): void
    {
        ['company' => $company, 'person' => $person, 'employment' => $employment] = $this->mundo();

        $vacaciones = $this->makeAbsenceType($company, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones');
        $this->addAbsence($person, $vacaciones, '2026-07-13', '2026-07-19', $employment);

        $medica = $this->makeConceptType($company, Computation::Adds);

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $medica, '2026-07-15', '10:00', '12:00')
        );

        $this->assertTrue($result->has(RuleCode::Unavailable));
    }

    // ─────────── EL PARÁMETRO MUERTO QUE RESUCITA ───────────

    #[Test]
    public function las_horas_extra_tienen_su_propio_tope(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo([
            'max_overtime_minutes_year' => 600, // 10h de extras al año
        ]);

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');

        // 8h de extras ya hechas.
        $this->addConcept($employment, $extra, '2026-03-10', '18:00', '22:00'); // 4h
        $this->addConcept($employment, $extra, '2026-05-12', '18:00', '22:00'); // 4h

        // Otras 2h: quedaría en 10h de 10h. Es un MÁXIMO: cumple.
        $justo = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-07-15', '20:00', '22:00')
        );
        $this->assertFalse($justo->has(RuleCode::OvertimeLimit));

        // Un minuto más y se pasa.
        $pasa = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-07-15', '20:00', '22:01')
        );
        $this->assertTrue($pasa->has(RuleCode::OvertimeLimit));
        $this->assertSame(1, $pasa->violations->first()->context['excess_minutes']);
        $this->assertTrue($pasa->isPossible(), 'Pasarse de extras AVISA, pero deja registrar.');
    }

    #[Test]
    public function el_tope_de_extras_no_cuenta_las_horas_normales(): void
    {
        ['company' => $company, 'employment' => $employment, 'position' => $position] = $this->mundo([
            'max_overtime_minutes_year' => 600,
        ]);

        // 40h de trabajo normal y 4h de un concepto que SUMA al contador principal.
        // Ninguna de las dos cosas es una hora extra.
        foreach (['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17'] as $day) {
            $this->assign($employment, $position, $day, '09:00', '17:00');
        }
        $this->addConcept($employment, $this->makeConceptType($company, Computation::Adds), '2026-07-18', '09:00', '13:00');

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-07-19', '18:00', '22:00')
        );

        // Si el tope mirara el contador principal, esto reventaría.
        $this->assertFalse($result->has(RuleCode::OvertimeLimit));
    }

    #[Test]
    public function las_horas_extra_se_cuentan_contra_el_ano_de_computo_movil(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo([
            'max_overtime_minutes_year' => 600, // 10h
        ]);

        $company->update(['computation_year_start_month' => 9, 'computation_year_start_day' => 1]);
        $employment = $employment->fresh();

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');

        // 10h de extras en JULIO de 2026: pertenecen al año que arrancó en sept-2025.
        $this->addConcept($employment, $extra, '2026-07-10', '12:00', '22:00');

        // En agosto (mismo año de cómputo) ya no cabe nada más.
        $agosto = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-08-10', '20:00', '22:00')
        );
        $this->assertTrue($agosto->has(RuleCode::OvertimeLimit));

        // Pero en septiembre arranca un año nuevo y el contador vuelve a cero.
        $septiembre = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-09-10', '20:00', '22:00')
        );
        $this->assertFalse(
            $septiembre->has(RuleCode::OvertimeLimit),
            'El tope de extras no está usando el año de cómputo de la empresa.',
        );
    }

    #[Test]
    public function sin_tope_de_extras_acepta_todas_las_que_le_echen(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo(); // sin límite

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');

        for ($day = 1; $day <= 20; $day++) {
            $this->addConcept($employment, $extra, sprintf('2026-07-%02d', $day), '12:00', '22:00'); // 10h/día
        }

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-07-25', '12:00', '22:00')
        );

        // null = sin límite, no cero. Coherente con el resto del motor.
        $this->assertFalse($result->has(RuleCode::OvertimeLimit));
    }

    #[Test]
    public function no_se_puede_registrar_un_concepto_en_un_contrato_terminado(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo();

        $employment->update(['ends_on' => '2026-06-30']);

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment->fresh(), $this->makeConceptType($company, Computation::Adds),
                '2026-07-15', '10:00', '12:00')
        );

        $this->assertTrue($result->has(RuleCode::ContractInactive));
        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function un_concepto_de_duracion_cero_es_imposible(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo();

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $this->makeConceptType($company, Computation::Adds),
                '2026-07-15', '10:00', '10:00')
        );

        $this->assertTrue($result->has(RuleCode::InvalidInterval));
    }

    #[Test]
    public function al_mover_un_concepto_no_choca_consigo_mismo(): void
    {
        ['company' => $company, 'employment' => $employment] = $this->mundo([
            'max_overtime_minutes_year' => 240, // 4h justas
        ]);

        $extra = $this->makeConceptType($company, Computation::SeparateCounter, 'Hora extra');
        $existente = $this->addConcept($employment, $extra, '2026-07-15', '18:00', '22:00'); // 4h

        // Se mueve ESE MISMO concepto una hora más tarde. Sigue siendo 4h.
        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $extra, '2026-07-15', '19:00', '23:00',
                ignoreConceptEntryId: $existente->id)
        );

        $this->assertTrue($result->isClean(), 'El concepto está chocando contra su propia versión antigua.');
    }
}
