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

        $shifts = $occupied->assignments->map(fn (Assignment $other) => Violation::impossible(
            RuleCode::Overlap,
            sprintf(
                'Ya tiene un turno de %s a %s en %s.',
                $other->starts_at->format('H:i'),
                $other->ends_at->format('H:i'),
                $other->company->name,
            ),
            ['assignment_id' => $other->id, 'company_id' => $other->company_id],
        ))->all();

        $concepts = $occupied->conceptEntries->map(fn (ConceptEntry $entry) => Violation::impossible(
            RuleCode::Overlap,
            sprintf(
                'Solapa con "%s", de %s a %s.',
                $entry->conceptType->name,
                $entry->starts_at->format('H:i'),
                $entry->ends_at->format('H:i'),
            ),
            ['concept_entry_id' => $entry->id],
        ))->all();

        return [...$shifts, ...$concepts];
    }
}
