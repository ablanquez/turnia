<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\RuleCode;
use App\Services\Scheduling\HourCounter;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;
use App\Services\Scheduling\WindowResolver;
use App\Support\TimeWindow;

/**
 * ¿Se pasa del tope de horas?
 *
 * Tres ventanas, la misma función. El límite se resuelve con
 * COALESCE(override_del_contrato, valor_del_perfil), y NULL significa SIN LÍMITE,
 * no cero.
 *
 * El tope es un MÁXIMO: llegar exactamente a 40h de 40h CUMPLE. Se incumple a
 * partir del minuto 2401.
 */
class HourLimitRule implements Rule
{
    public function __construct(
        private LimitResolver $limits,
        private HourCounter $counter,
        private WindowResolver $windows,
    ) {}

    public function check(AssignmentDraft $draft): array
    {
        $limits = $this->limits->for($draft->employment);
        $duration = $draft->durationMinutes();
        $violations = [];

        // Un intervalo corrupto lo caza IntervalSanityRule: aquí no se computa.
        if ($duration <= 0) {
            return [];
        }

        if ($limits->maxMinutesPerShift !== null && $duration > $limits->maxMinutesPerShift) {
            $violations[] = Violation::breach(
                RuleCode::ShiftLength,
                sprintf(
                    'El turno dura %s, y el máximo por turno es %s.',
                    $this->hours($duration),
                    $this->hours($limits->maxMinutesPerShift),
                ),
                ['duration_minutes' => $duration, 'limit_minutes' => $limits->maxMinutesPerShift],
            );
        }

        $company = $draft->employment->company;

        $checks = [
            'week' => [$this->windows->week($draft->workDate), $limits->maxMinutesWeek, 'semanal'],
            'month' => [$this->windows->month($draft->workDate), $limits->maxMinutesMonth, 'mensual'],
            'year' => [$this->windows->computationYear($company, $draft->workDate), $limits->maxMinutesYear, 'anual'],
        ];

        foreach ($checks as $key => [$window, $limit, $label]) {
            if ($limit === null) {
                continue; // Sin límite. NO es cero.
            }

            $violation = $this->checkWindow($draft, $window, $limit, $key, $label, $duration);

            if ($violation !== null) {
                $violations[] = $violation;
            }
        }

        return $violations;
    }

    private function checkWindow(
        AssignmentDraft $draft,
        TimeWindow $window,
        int $limit,
        string $key,
        string $label,
        int $duration,
    ): ?Violation {
        // Lo ya computado en la ventana, sin contar la propia asignación si se mueve.
        $current = $this->counter->workedMinutes($draft->employment, $window, $draft->ignoreAssignmentId);
        $resulting = $current + $duration;

        if ($resulting <= $limit) {
            return null;
        }

        return Violation::breach(
            RuleCode::HourLimit,
            sprintf(
                'Se pasa del tope %s: quedaría en %s de un máximo de %s.',
                $label,
                $this->hours($resulting),
                $this->hours($limit),
            ),
            [
                'window' => $key,
                'window_from' => $window->from->toDateString(),
                'window_to' => $window->to->toDateString(),
                'current_minutes' => $current,
                'resulting_minutes' => $resulting,
                'limit_minutes' => $limit,
                'excess_minutes' => $resulting - $limit,
            ],
        );
    }

    /** Minutos enteros en la base; horas legibles solo para el mensaje. */
    private function hours(int $minutes): string
    {
        return sprintf('%dh %02dmin', intdiv($minutes, 60), $minutes % 60);
    }
}
