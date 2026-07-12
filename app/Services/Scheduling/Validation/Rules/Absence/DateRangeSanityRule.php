<?php

namespace App\Services\Scheduling\Validation\Rules\Absence;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceRule;
use App\Services\Scheduling\Validation\Violation;

/** El rango tiene que ser un rango. Una ausencia abierta (sin fin) SÍ es válida. */
class DateRangeSanityRule implements AbsenceRule
{
    public function check(AbsenceDraft $draft): array
    {
        if ($draft->isOpenEnded() || $draft->endsOn->gte($draft->startsOn)) {
            return [];
        }

        return [Violation::impossible(
            RuleCode::InvalidDateRange,
            'La ausencia termina antes de empezar.',
            [
                'starts_on' => $draft->startsOn->toDateString(),
                'ends_on' => $draft->endsOn->toDateString(),
            ],
        )];
    }
}
