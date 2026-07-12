<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\ConceptEntry;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;

/**
 * No puede estar en dos sitios a la vez.
 *
 * A NIVEL DE PERSONA, cruzando empresas: María no puede estar en el Bar A y en el
 * Bar B a las 10:00. Y tampoco puede estar en caja si tiene una hora médica: un
 * concepto horario ocupa su tiempo aunque no cubra puesto — y también cuenta el
 * concepto registrado en la OTRA empresa, porque físicamente está en el médico.
 *
 * Intervalos SEMIABIERTOS [inicio, fin): un turno que acaba a las 22:00 y otro que
 * empieza a las 22:00 NO solapan. Si no, ningún turno consecutivo sería legal.
 */
class OverlapRule implements Rule
{
    public function check(AssignmentDraft $draft): array
    {
        $violations = [];

        $assignments = Assignment::query()
            ->where('person_id', $draft->personId())
            ->when($draft->ignoreAssignmentId, fn ($q, $id) => $q->whereKeyNot($id))
            ->where('starts_at', '<', $draft->endsAt)
            ->where('ends_at', '>', $draft->startsAt)
            ->with('company')
            ->get();

        foreach ($assignments as $other) {
            $violations[] = Violation::impossible(
                RuleCode::Overlap,
                sprintf(
                    'Ya tiene un turno de %s a %s en %s.',
                    $other->starts_at->format('H:i'),
                    $other->ends_at->format('H:i'),
                    $other->company->name,
                ),
                ['assignment_id' => $other->id, 'company_id' => $other->company_id],
            );
        }

        $concepts = ConceptEntry::query()
            ->where('person_id', $draft->personId())
            ->where('starts_at', '<', $draft->endsAt)
            ->where('ends_at', '>', $draft->startsAt)
            ->with('conceptType')
            ->get();

        foreach ($concepts as $entry) {
            $violations[] = Violation::impossible(
                RuleCode::Overlap,
                sprintf(
                    'Solapa con "%s", de %s a %s.',
                    $entry->conceptType->name,
                    $entry->starts_at->format('H:i'),
                    $entry->ends_at->format('H:i'),
                ),
                ['concept_entry_id' => $entry->id],
            );
        }

        return $violations;
    }
}
