<?php

namespace App\Services\Scheduling;

use App\Enums\AbsenceScope;
use App\Models\Absence;
use App\Models\Employment;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * El cupo de vacaciones, medido en DÍAS LABORABLES.
 *
 * Un festivo o un domingo dentro de las vacaciones NO consume cupo: no ibas a
 * trabajar ese día de todos modos. Qué días son laborables lo dice la empresa
 * (non_working_weekdays + holidays), no el código.
 *
 * El cupo es del CONTRATO, porque vive en el perfil y el perfil es del contrato: dos
 * contratos de la misma persona tienen cupos independientes.
 */
class LeaveQuota
{
    public function __construct(private WorkdayCalendar $calendar) {}

    /**
     * Días laborables que una ausencia consume DENTRO de una ventana concreta.
     *
     * El recorte a la ventana es lo que hace que unas vacaciones a caballo del fin
     * del año de cómputo consuman de cada año lo que le toca. Si contaran enteras
     * contra el año de inicio, se podrían colar 40 días saltando la frontera.
     */
    public function daysConsumedWithin(Employment $employment, CarbonImmutable $startsOn, ?CarbonImmutable $endsOn, TimeWindow $window): int
    {
        if ($endsOn === null) {
            return 0; // Ausencia abierta: no se puede contar lo que no tiene fin.
        }

        $from = $startsOn->max($window->from);
        $to = $endsOn->min($window->to);

        return $this->calendar->countWorkingDays($employment->company, $from, $to);
    }

    /**
     * Días de cupo YA consumidos por este contrato dentro de la ventana.
     *
     * Solo cuentan las ausencias de tipos con consumes_leave_quota y alcance de
     * contrato: una ausencia de alcance persona no tiene contrato del que descontar.
     */
    public function consumedDays(Employment $employment, TimeWindow $window, ?int $exceptAbsenceId = null): int
    {
        $absences = Absence::query()
            ->where('employment_id', $employment->id)
            ->whereNotNull('ends_on')
            ->whereHas('absenceType', fn (Builder $q) => $q
                ->where('consumes_leave_quota', true)
                ->where('scope', AbsenceScope::Employment))
            ->where('starts_on', '<=', $window->to->toDateString())
            ->where('ends_on', '>=', $window->from->toDateString())
            ->when($exceptAbsenceId, fn (Builder $q, $id) => $q->whereKeyNot($id))
            ->get();

        return $absences->sum(fn (Absence $absence) => $this->daysConsumedWithin(
            $employment,
            CarbonImmutable::parse($absence->starts_on),
            CarbonImmutable::parse($absence->ends_on),
            $window,
        ));
    }
}
