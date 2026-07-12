<?php

namespace App\Services\Scheduling\Validation\Rules\Concept;

use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Services\Scheduling\HourCounter;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptRule;
use App\Services\Scheduling\Validation\Violation;
use App\Services\Scheduling\WindowResolver;

/**
 * El tope del contador APARTE: las horas extra.
 *
 * Este es el punto de aplicación que le faltaba a max_overtime_minutes_year, que
 * llevaba dos tandas en la base sin que nadie lo mirara. Una asignación nunca genera
 * horas extra: las extras son conceptos con computation = 'separate_counter'. Por eso
 * el tope solo puede comprobarse aquí.
 *
 * Es un MÁXIMO: llegar justo al tope cumple. Y null = SIN LÍMITE, no cero.
 * La ventana es el año de cómputo de la empresa, que puede no ser el natural.
 */
class OvertimeLimitRule implements ConceptRule
{
    public function __construct(
        private LimitResolver $limits,
        private HourCounter $counter,
        private WindowResolver $windows,
    ) {}

    public function check(ConceptEntryDraft $draft): array
    {
        if ($draft->conceptType->computation !== Computation::SeparateCounter) {
            return [];
        }

        $limit = $this->limits->for($draft->employment)->maxOvertimeMinutesYear;

        if ($limit === null) {
            return []; // Sin límite. No es cero.
        }

        $duration = $draft->durationMinutes();

        if ($duration <= 0) {
            return []; // Intervalo corrupto: lo caza IntervalSanityRule.
        }

        $window = $this->windows->computationYear(
            $draft->employment->company,
            $draft->workDate,
        );

        $current = $this->counter->overtimeMinutes(
            $draft->employment,
            $window,
            $draft->ignoreConceptEntryId,
        );

        $resulting = $current + $duration;

        if ($resulting <= $limit) {
            return [];
        }

        return [Violation::breach(
            RuleCode::OvertimeLimit,
            sprintf(
                'Se pasa del tope de horas extra: quedaría en %s de un máximo de %s.',
                $this->hours($resulting),
                $this->hours($limit),
            ),
            [
                'window_from' => $window->from->toDateString(),
                'window_to' => $window->to->toDateString(),
                'current_minutes' => $current,
                'resulting_minutes' => $resulting,
                'limit_minutes' => $limit,
                'excess_minutes' => $resulting - $limit,
            ],
        )];
    }

    private function hours(int $minutes): string
    {
        return sprintf('%dh %02dmin', intdiv($minutes, 60), $minutes % 60);
    }
}
