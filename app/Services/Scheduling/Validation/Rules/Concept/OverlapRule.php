<?php

namespace App\Services\Scheduling\Validation\Rules\Concept;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\ConceptEntry;
use App\Services\Scheduling\PersonTimeline;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * La dirección que faltaba.
 *
 * Hasta ahora el solape solo se veía al colocar la asignación: se podía registrar
 * una hora médica encima de un turno ya puesto y nadie decía nada. Con el mismo
 * PersonTimeline que usa la asignación, ahora se ve en las dos direcciones y con un
 * único criterio.
 *
 * A NIVEL DE PERSONA, cruzando empresas: la hora médica ocupa a María entera, no
 * solo en el bar donde se registró.
 */
class OverlapRule implements ConceptRule
{
    public function __construct(private PersonTimeline $timeline) {}

    public function check(ConceptEntryDraft $draft): array
    {
        $occupied = $this->timeline->occupations(
            personId: $draft->personId(),
            from: $draft->startsAt,
            to: $draft->endsAt,
            exceptConceptEntryId: $draft->ignoreConceptEntryId,
        );

        $shifts = $occupied->assignments->map(fn (Assignment $other) => Violation::impossible(
            RuleCode::Overlap,
            sprintf(
                'Pisa un turno de %s a %s en %s.',
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
