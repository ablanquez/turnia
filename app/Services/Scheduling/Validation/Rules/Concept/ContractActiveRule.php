<?php

namespace App\Services\Scheduling\Validation\Rules\Concept;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptRule;
use App\Services\Scheduling\Validation\Violation;
use Carbon\CarbonImmutable;

/**
 * El concepto tiene que caer dentro de la vigencia del contrato.
 *
 * No se puede registrar una hora médica de alguien que ya no trabaja aquí.
 */
class ContractActiveRule implements ConceptRule
{
    public function check(ConceptEntryDraft $draft): array
    {
        $employment = $draft->employment;
        $workDate = $draft->workDate->startOfDay();

        $startsOn = CarbonImmutable::parse($employment->starts_on)->startOfDay();

        if ($workDate->lt($startsOn)) {
            return [Violation::impossible(
                RuleCode::ContractInactive,
                sprintf('El contrato no empieza hasta el %s.', $startsOn->format('d/m/Y')),
                ['starts_on' => $startsOn->toDateString()],
            )];
        }

        if ($employment->ends_on !== null) {
            $endsOn = CarbonImmutable::parse($employment->ends_on)->startOfDay();

            if ($workDate->gt($endsOn)) {
                return [Violation::impossible(
                    RuleCode::ContractInactive,
                    sprintf('El contrato terminó el %s.', $endsOn->format('d/m/Y')),
                    ['ends_on' => $endsOn->toDateString()],
                )];
            }
        }

        return [];
    }
}
