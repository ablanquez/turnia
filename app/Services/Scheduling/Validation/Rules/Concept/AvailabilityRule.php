<?php

namespace App\Services\Scheduling\Validation\Rules\Concept;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Models\Absence;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptRule;
use App\Services\Scheduling\Validation\Violation;
use Illuminate\Database\Eloquent\Builder;

/**
 * No tiene sentido una hora médica dentro de unas vacaciones.
 *
 * Mismo criterio de alcance que en las asignaciones: una ausencia de persona bloquea
 * en todas sus empresas; una de contrato, solo en el suyo. ends_on NULL = abierta.
 */
class AvailabilityRule implements ConceptRule
{
    public function check(ConceptEntryDraft $draft): array
    {
        $workDate = $draft->workDate->toDateString();

        return Absence::query()
            ->where('person_id', $draft->personId())
            ->whereHas('absenceType', fn (Builder $q) => $q->where('computation', Computation::Blocks))
            ->where('starts_on', '<=', $workDate)
            ->where(fn (Builder $q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $workDate))
            ->where(function (Builder $q) use ($draft) {
                $q->whereHas('absenceType', fn (Builder $t) => $t->where('scope', AbsenceScope::Person))
                    ->orWhere('employment_id', $draft->employment->id);
            })
            ->with('absenceType')
            ->get()
            ->map(fn (Absence $absence) => Violation::impossible(
                RuleCode::Unavailable,
                sprintf('Está de "%s" ese día.', $absence->absenceType->name),
                ['absence_id' => $absence->id, 'scope' => $absence->absenceType->scope->value],
            ))
            ->all();
    }
}
