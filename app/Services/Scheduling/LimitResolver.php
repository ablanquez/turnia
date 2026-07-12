<?php

namespace App\Services\Scheduling;

use App\Enums\WorkdayType;
use App\Models\Employment;

/**
 * El COALESCE(override_del_contrato, valor_del_perfil).
 *
 * La excepción individual gana al perfil. Si no hay ni una ni otro, no hay límite.
 */
class LimitResolver
{
    public function for(Employment $employment): LimitSet
    {
        $profile = $employment->profile;

        $workdayType = $employment->workday_type_override
            ? WorkdayType::from($employment->workday_type_override)
            : ($profile?->workday_type ?? WorkdayType::Any);

        return new LimitSet(
            maxMinutesYear: $employment->max_minutes_year_override ?? $profile?->max_minutes_year,
            maxMinutesMonth: $employment->max_minutes_month_override ?? $profile?->max_minutes_month,
            maxMinutesWeek: $employment->max_minutes_week_override ?? $profile?->max_minutes_week,
            maxMinutesPerShift: $employment->max_minutes_per_shift_override ?? $profile?->max_minutes_per_shift,
            minRestMinutesBetweenShifts: $employment->min_rest_minutes_between_shifts_override
                ?? $profile?->min_rest_minutes_between_shifts,
            maxOvertimeMinutesYear: $employment->max_overtime_minutes_year_override
                ?? $profile?->max_overtime_minutes_year,
            annualLeaveDays: $employment->annual_leave_days_override ?? $profile?->annual_leave_days,
            workdayType: $workdayType,
            hasProfile: $profile !== null,
        );
    }
}
