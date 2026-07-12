<?php

namespace App\Services\Scheduling;

use App\Enums\Computation;
use App\Models\Assignment;
use App\Models\ConceptEntry;
use App\Models\Employment;
use App\Support\TimeWindow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * El contador de horas.
 *
 * Es una CONSULTA, no un campo acumulado. Semana, mes y año son la misma función
 * con distinta ventana: si un día hace falta el trimestre, no hay que tocar nada.
 *
 * Todo en MINUTOS ENTEROS. Nunca horas decimales.
 *
 * La duración se calcula sobre starts_at/ends_at, que son instantes UTC. Por eso
 * la noche del cambio de hora un turno de 22:00 a 06:00 sale de 9h y no de 8h,
 * sin ningún caso especial.
 */
class HourCounter
{
    /**
     * Minutos que cuentan como trabajados: las asignaciones más los conceptos
     * cuyo tipo suma al contador.
     */
    public function workedMinutes(Employment $employment, TimeWindow $window, ?int $excludeAssignmentId = null): int
    {
        return $this->assignedMinutes($employment, $window, $excludeAssignmentId)
            + $this->conceptMinutes($employment, $window, Computation::Adds);
    }

    /** Solo las asignaciones. */
    public function assignedMinutes(Employment $employment, TimeWindow $window, ?int $excludeAssignmentId = null): int
    {
        $query = Assignment::query()
            ->where('employment_id', $employment->id)
            ->whereBetween('work_date', $window->toDateRange());

        if ($excludeAssignmentId !== null) {
            $query->whereKeyNot($excludeAssignmentId);
        }

        return $this->sumMinutes($query);
    }

    /** El contador APARTE: las horas extra, con su propio tope. */
    public function overtimeMinutes(Employment $employment, TimeWindow $window): int
    {
        return $this->conceptMinutes($employment, $window, Computation::SeparateCounter);
    }

    /** Lo que se RESTA de la jornada exigible, en vez de sumarse a la realizada. */
    public function requiredReductionMinutes(Employment $employment, TimeWindow $window): int
    {
        return $this->conceptMinutes($employment, $window, Computation::ReducesRequired);
    }

    private function conceptMinutes(Employment $employment, TimeWindow $window, Computation $computation): int
    {
        return $this->sumMinutes(
            ConceptEntry::query()
                ->where('employment_id', $employment->id)
                ->whereBetween('work_date', $window->toDateRange())
                ->whereHas('conceptType', fn (Builder $q) => $q->where('computation', $computation))
        );
    }

    private function sumMinutes(Builder $query): int
    {
        return (int) $query->sum(DB::raw('TIMESTAMPDIFF(MINUTE, starts_at, ends_at)'));
    }
}
