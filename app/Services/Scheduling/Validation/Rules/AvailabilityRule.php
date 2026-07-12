<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Models\Absence;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;
use Illuminate\Database\Eloquent\Builder;

/**
 * ¿Está bloqueado por una ausencia?
 *
 * El scope del tipo de ausencia decide el alcance:
 *   - person     (baja laboral) → bloquea en TODAS sus empresas. El tobillo roto
 *                                 no distingue de bares.
 *   - employment (vacaciones)   → bloquea solo en ese contrato. Puede coger
 *                                 vacaciones en el Bar A y seguir yendo al Bar B.
 *
 * ends_on NULL = baja abierta, indefinida: bloquea desde su inicio hacia adelante,
 * sin fecha de fin.
 */
class AvailabilityRule implements Rule
{
    public function check(AssignmentDraft $draft): array
    {
        $workDate = $draft->workDate->toDateString();

        $absences = Absence::query()
            ->where('person_id', $draft->personId())
            ->whereHas('absenceType', fn (Builder $q) => $q->where('computation', Computation::Blocks))
            ->where('starts_on', '<=', $workDate)
            ->where(fn (Builder $q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $workDate))
            ->where(function (Builder $q) use ($draft) {
                // De persona: alcanza a cualquier contrato suyo.
                $q->whereHas('absenceType', fn (Builder $t) => $t->where('scope', AbsenceScope::Person))
                    // De contrato: solo alcanza a ESTE contrato.
                    ->orWhere('employment_id', $draft->employment->id);
            })
            ->with('absenceType')
            ->get();

        return $absences->map(fn (Absence $absence) => Violation::impossible(
            RuleCode::Unavailable,
            $absence->ends_on === null
                ? sprintf('Está de "%s" desde el %s, sin fecha de fin.',
                    $absence->absenceType->name, $absence->starts_on->format('d/m/Y'))
                : sprintf('Está de "%s" del %s al %s.',
                    $absence->absenceType->name,
                    $absence->starts_on->format('d/m/Y'),
                    $absence->ends_on->format('d/m/Y')),
            [
                'absence_id' => $absence->id,
                'scope' => $absence->absenceType->scope->value,
            ],
        ))->all();
    }
}
