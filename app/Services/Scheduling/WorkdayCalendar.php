<?php

namespace App\Services\Scheduling;

use App\Models\Company;
use App\Models\Holiday;
use Carbon\CarbonImmutable;

/**
 * ¿Es laborable este día para esta empresa?
 *
 * "Día laborable" = no está en non_working_weekdays Y no es festivo.
 *
 * Las dos cosas son PARÁMETRO, no regla cableada: sábado y domingo son solo el valor
 * por defecto, y hay negocios que abren el domingo y libran el lunes. El motor no
 * sabe qué días libra un bar: se lo pregunta al bar.
 */
class WorkdayCalendar
{
    /** @var array<int, array<string, true>> Festivos ya leídos, por empresa. */
    private array $holidays = [];

    public function isWorkingDay(Company $company, CarbonImmutable $date): bool
    {
        $nonWorking = $company->non_working_weekdays ?? [];

        if (in_array($date->dayOfWeekIso, $nonWorking, true)) {
            return false;
        }

        return ! $this->isHoliday($company, $date);
    }

    public function isHoliday(Company $company, CarbonImmutable $date): bool
    {
        return isset($this->holidaysFor($company)[$date->toDateString()]);
    }

    /** Días laborables del rango, ambos extremos incluidos. */
    public function countWorkingDays(Company $company, CarbonImmutable $from, CarbonImmutable $to): int
    {
        if ($to->lt($from)) {
            return 0;
        }

        $days = 0;

        for ($date = $from->startOfDay(); $date->lte($to); $date = $date->addDay()) {
            if ($this->isWorkingDay($company, $date)) {
                $days++;
            }
        }

        return $days;
    }

    /** @return array<string, true> */
    private function holidaysFor(Company $company): array
    {
        return $this->holidays[$company->id] ??= Holiday::query()
            ->where('company_id', $company->id)
            ->pluck('date')
            ->mapWithKeys(fn ($date) => [CarbonImmutable::parse($date)->toDateString() => true])
            ->all();
    }
}
