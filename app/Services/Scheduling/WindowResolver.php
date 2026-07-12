<?php

namespace App\Services\Scheduling;

use App\Models\Company;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;

/**
 * Construye las ventanas. Es el único sitio que sabe que la semana empieza en
 * lunes y que el año de una empresa puede arrancar en septiembre.
 */
class WindowResolver
{
    /** Semana ISO: de lunes a domingo. */
    public function week(CarbonImmutable $localDate): TimeWindow
    {
        return new TimeWindow(
            $localDate->startOfWeek(CarbonImmutable::MONDAY)->startOfDay(),
            $localDate->endOfWeek(CarbonImmutable::SUNDAY)->startOfDay(),
        );
    }

    /**
     * Un solo día.
     *
     * No es un caso especial: es la misma ventana con los dos extremos iguales. El motor
     * no sabe si le están pidiendo un día, una semana o un año — solo recibe una ventana.
     */
    public function day(CarbonImmutable $localDate): TimeWindow
    {
        return new TimeWindow($localDate->startOfDay(), $localDate->startOfDay());
    }

    public function month(CarbonImmutable $localDate): TimeWindow
    {
        return new TimeWindow(
            $localDate->startOfMonth(),
            $localDate->endOfMonth()->startOfDay(),
        );
    }

    /**
     * El año de cómputo de la empresa, que puede no ser el año natural.
     *
     * El arranque se guarda como mes + día porque se repite cada año: guardar una
     * fecha obligaría a actualizarla cada 1 de septiembre.
     */
    public function computationYear(Company $company, CarbonImmutable $localDate): TimeWindow
    {
        $start = $this->yearStartFor($company, $localDate->year);

        // Si la fecha cae antes del arranque, pertenece al año de cómputo anterior.
        if ($localDate->lt($start)) {
            $start = $this->yearStartFor($company, $localDate->year - 1);
        }

        return new TimeWindow($start, $start->addYear()->subDay());
    }

    private function yearStartFor(Company $company, int $year): CarbonImmutable
    {
        $month = $company->computation_year_start_month;

        // Un arranque en día 29-31 no existe en todos los meses: se ancla al último
        // día real del mes en vez de desbordar al mes siguiente.
        $day = min(
            $company->computation_year_start_day,
            CarbonImmutable::create($year, $month, 1)->daysInMonth,
        );

        return CarbonImmutable::create($year, $month, $day)->startOfDay();
    }
}
