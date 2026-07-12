<?php

namespace App\Services\Scheduling\Validation\Rules\Assignment;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\ConceptEntry;
use App\Services\Scheduling\PersonTimeline;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * No puede estar en dos sitios a la vez.
 *
 * A NIVEL DE PERSONA, cruzando empresas: María no puede estar en el Bar A y en el
 * Bar B a las 10:00. Y tampoco puede estar en caja si tiene una hora médica: un
 * concepto horario ocupa su tiempo aunque no cubra puesto — incluido el registrado
 * en la OTRA empresa, porque físicamente está en el médico.
 *
 * El criterio del solape vive en PersonTimeline, compartido con la regla de
 * conceptos: así se detecta en las DOS direcciones con un solo criterio.
 */
class OverlapRule implements AssignmentRule
{
    public function __construct(private PersonTimeline $timeline) {}

    public function check(AssignmentDraft $draft): array
    {
        $occupied = $this->timeline->occupations(
            personId: $draft->personId(),
            from: $draft->startsAt,
            to: $draft->endsAt,
            exceptAssignmentId: $draft->ignoreAssignmentId,
        );

        // La hora se cuenta EN EL RELOJ DE LA EMPRESA DONDE OCURRE, no en UTC ni en la
        // de quien mira. Un turno del bar de Canarias se nombra con la hora de Canarias.
        $shifts = $occupied->assignments->map(fn (Assignment $other) => Violation::impossible(
            RuleCode::Overlap,
            sprintf(
                'Ya tiene un turno de %s a %s en %s.',
                $other->company->localTime($other->starts_at),
                $other->company->localTime($other->ends_at),
                $other->company->name,
            ),
            ['assignment_id' => $other->id, 'company_id' => $other->company_id],
        ))->all();

        $concepts = $occupied->conceptEntries->map(fn (ConceptEntry $entry) => Violation::impossible(
            RuleCode::Overlap,
            sprintf(
                'Solapa con "%s", de %s a %s.',
                $entry->conceptType->name,
                $entry->company->localTime($entry->starts_at),
                $entry->company->localTime($entry->ends_at),
            ),
            ['concept_entry_id' => $entry->id],
        ))->all();

        return [...$shifts, ...$concepts];
    }
}
