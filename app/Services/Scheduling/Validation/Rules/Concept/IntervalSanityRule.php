<?php

namespace App\Services\Scheduling\Validation\Rules\Concept;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptRule;
use App\Services\Scheduling\Validation\Violation;

/** Mismo criterio físico que en las asignaciones: el tiempo tiene que ser tiempo. */
class IntervalSanityRule implements ConceptRule
{
    public const MAX_MINUTES = 24 * 60;

    public function check(ConceptEntryDraft $draft): array
    {
        $minutes = $draft->durationMinutes();

        if ($minutes <= 0) {
            return [Violation::impossible(
                RuleCode::InvalidInterval,
                $minutes === 0
                    ? 'El concepto dura cero minutos.'
                    : 'El concepto termina antes de empezar.',
                ['duration_minutes' => $minutes],
            )];
        }

        if ($minutes > self::MAX_MINUTES) {
            return [Violation::impossible(
                RuleCode::ShiftTooLong,
                sprintf('El concepto dura %d minutos: más de 24 horas seguidas.', $minutes),
                ['duration_minutes' => $minutes, 'max_minutes' => self::MAX_MINUTES],
            )];
        }

        return [];
    }
}
