<?php

namespace App\Services\Scheduling\Validation\Rules\Assignment;

use App\Enums\RuleCode;
use App\Enums\WorkdayType;
use App\Models\Assignment;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * El perfil dice qué tipo de jornada admite.
 *
 * 'continuous' → un solo turno al día. Un segundo turno el mismo work_date convierte
 *                la jornada en partida, y ese perfil no la admite.
 * 'split'      → PERMITE partida. Permitir no es obligar: un día continuo no avisa.
 * 'any'        → no valida nada.
 *
 * Reutiliza el criterio de work_date de la regla del descanso: una partida es "dos
 * turnos el mismo work_date".
 *
 * Se mira dentro del CONTRATO, no de la persona. El workday_type es un parámetro del
 * perfil, y el perfil es del contrato: si María hace la mañana en el Bar A y la tarde
 * en el Bar B, el Bar A le ha dado una jornada continua y su perfil no está roto —
 * no puede incumplir por un turno que le dio otra empresa y que no controla. Ese caso
 * cruzado ya lo cubre SharedWorkdayRule con su aviso informativo.
 */
class WorkdayTypeRule implements AssignmentRule
{
    public function __construct(private LimitResolver $limits) {}

    public function check(AssignmentDraft $draft): array
    {
        if ($this->limits->for($draft->employment)->workdayType !== WorkdayType::Continuous) {
            return [];
        }

        $others = Assignment::query()
            ->where('employment_id', $draft->employment->id)
            ->where('work_date', $draft->workDate->toDateString())
            ->when($draft->ignoreAssignmentId, fn ($q, $id) => $q->whereKeyNot($id))
            ->get();

        if ($others->isEmpty()) {
            return [];
        }

        $company = $draft->employment->company;

        return [Violation::breach(
            RuleCode::WorkdayType,
            sprintf(
                'El perfil solo admite jornada continua, y ese día ya tiene otro turno (%s a %s).',
                // En el reloj de la empresa, no en UTC.
                $company->localTime($others->first()->starts_at),
                $company->localTime($others->first()->ends_at),
            ),
            [
                'workday_type' => WorkdayType::Continuous->value,
                'assignment_ids' => $others->pluck('id')->all(),
            ],
        )];
    }
}
