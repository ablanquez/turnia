<?php

namespace App\Services\Scheduling\Validation\Rules\Absence;

use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Services\Scheduling\OrphanFinder;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * "Registrar esta baja deja 3 turnos al descubierto."
 *
 * Es lo que el encargado necesita saber en el momento exacto en que registra la baja:
 * qué huecos acaba de abrir y tiene que recubrir.
 *
 * Reutiliza el OrphanFinder, que ya existía: las huérfanas siguen siendo una consulta
 * y no un flag.
 */
class OrphanWarningRule implements AbsenceRule
{
    public function __construct(private OrphanFinder $finder) {}

    public function check(AbsenceDraft $draft): array
    {
        if ($draft->absenceType->computation !== Computation::Blocks) {
            return [];
        }

        $orphans = $this->finder->forDraft($draft);

        if ($orphans->isEmpty()) {
            return [];
        }

        return [Violation::notice(
            RuleCode::OrphanedAssignments,
            sprintf(
                'Esta ausencia deja %d turno(s) al descubierto: %s.',
                $orphans->count(),
                $orphans->take(3)->map(fn (Assignment $a) => sprintf(
                    '%s %s (%s)',
                    $a->work_date->format('d/m'),
                    $a->position->name,
                    $a->company->name,
                ))->join(', '),
            ),
            [
                'orphan_count' => $orphans->count(),
                'assignment_ids' => $orphans->pluck('id')->all(),
            ],
        )];
    }
}
