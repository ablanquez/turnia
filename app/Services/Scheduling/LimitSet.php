<?php

namespace App\Services\Scheduling;

use App\Enums\WorkdayType;

/**
 * Los límites de un contrato, YA resueltos.
 *
 * null significa SIN LÍMITE. No es cero. Es la confusión que más bugs produce en
 * este tipo de motores, así que vive aquí y en un solo sitio.
 */
final readonly class LimitSet
{
    public function __construct(
        public ?int $maxMinutesYear,
        public ?int $maxMinutesMonth,
        public ?int $maxMinutesWeek,
        public ?int $maxMinutesPerShift,
        public ?int $minRestMinutesBetweenShifts,
        public ?int $maxOvertimeMinutesYear,
        public ?int $annualLeaveDays,
        public WorkdayType $workdayType,
        public bool $hasProfile,
    ) {}
}
