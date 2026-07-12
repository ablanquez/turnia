<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;
use Carbon\CarbonImmutable;

/**
 * El turno tiene que caer dentro de la vigencia del contrato.
 *
 * Es IMPOSIBLE, no incumplimiento: no hay contrato bajo el que trabajar. No es que
 * se rompa el convenio, es que el dato no tiene sentido.
 */
class ContractActiveRule implements Rule
{
    public function check(AssignmentDraft $draft): array
    {
        $employment = $draft->employment;
        $workDate = $draft->workDate->startOfDay();

        $startsOn = CarbonImmutable::parse($employment->starts_on)->startOfDay();

        if ($workDate->lt($startsOn)) {
            return [Violation::impossible(
                RuleCode::ContractInactive,
                sprintf('El contrato no empieza hasta el %s.', $startsOn->format('d/m/Y')),
                ['starts_on' => $startsOn->toDateString(), 'work_date' => $workDate->toDateString()],
            )];
        }

        if ($employment->ends_on !== null) {
            $endsOn = CarbonImmutable::parse($employment->ends_on)->startOfDay();

            if ($workDate->gt($endsOn)) {
                return [Violation::impossible(
                    RuleCode::ContractInactive,
                    sprintf('El contrato terminó el %s.', $endsOn->format('d/m/Y')),
                    ['ends_on' => $endsOn->toDateString(), 'work_date' => $workDate->toDateString()],
                )];
            }
        }

        return [];
    }
}
