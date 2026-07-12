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
 * Es una CONSULTA, no un campo acumulado. Semana, mes y año son la misma función con
 * distinta ventana: si un día hace falta el trimestre, no hay que tocar nada.
 *
 * Todo en MINUTOS ENTEROS. Nunca horas decimales.
 *
 * La duración se calcula sobre starts_at/ends_at, que son instantes UTC. Por eso la
 * noche del cambio de hora un turno de 22:00 a 06:00 sale de 9h y no de 8h, sin ningún
 * caso especial.
 *
 * NOTA DE RENDIMIENTO (medida, no supuesta): el contador cuesta 2 consultas y 0,6 ms,
 * incluso sobre la ventana ANUAL de una empresa con 32.000 asignaciones. No es el
 * cuello de botella de nada. Se probó a memoizarlo para acelerar el ViolationReport y
 * el resultado fue de 6.854 a 6.830 consultas: nada. La complejidad se retiró.
 */
class HourCounter
{
    /**
     * Minutos que cuentan como trabajados: las asignaciones más los conceptos cuyo tipo
     * suma al contador.
     */
    public function workedMinutes(Employment $employment, TimeWindow $window, ?int $excludeAssignmentId = null): int
    {
        return $this->assignedMinutes($employment, $window, $excludeAssignmentId)
            + $this->conceptMinutes($employment, $window, Computation::Adds);
    }

    /**
     * Lo mismo, pero para MUCHOS contratos a la vez, en dos consultas.
     *
     * El panel de plantilla necesita el contador de todo el equipo. Pedirlo contrato a
     * contrato son dos consultas por persona: 16 para un bar de 8, y 120 para el
     * almacén de 60. Es un N+1, aunque cada consulta suelta sea rapidísima.
     *
     * Sigue siendo UNA CONSULTA, no un acumulado: lo único que cambia es que agrupa.
     *
     * @param  array<int, int>  $employmentIds
     * @return array<int, int> employment_id => minutos (0 si no tiene nada)
     */
    public function workedMinutesFor(array $employmentIds, TimeWindow $window): array
    {
        if ($employmentIds === []) {
            return [];
        }

        $assigned = Assignment::query()
            ->whereIn('employment_id', $employmentIds)
            ->whereBetween('work_date', $window->toDateRange())
            ->groupBy('employment_id')
            ->pluck(DB::raw('SUM(TIMESTAMPDIFF(MINUTE, starts_at, ends_at))'), 'employment_id');

        $concepts = ConceptEntry::query()
            ->whereIn('employment_id', $employmentIds)
            ->whereBetween('work_date', $window->toDateRange())
            ->whereHas('conceptType', fn (Builder $q) => $q->where('computation', Computation::Adds))
            ->groupBy('employment_id')
            ->pluck(DB::raw('SUM(TIMESTAMPDIFF(MINUTE, starts_at, ends_at))'), 'employment_id');

        $minutes = [];

        foreach ($employmentIds as $id) {
            $minutes[$id] = (int) ($assigned[$id] ?? 0) + (int) ($concepts[$id] ?? 0);
        }

        return $minutes;
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
    public function overtimeMinutes(Employment $employment, TimeWindow $window, ?int $excludeConceptEntryId = null): int
    {
        return $this->conceptMinutes($employment, $window, Computation::SeparateCounter, $excludeConceptEntryId);
    }

    /** Lo que se RESTA de la jornada exigible, en vez de sumarse a la realizada. */
    public function requiredReductionMinutes(Employment $employment, TimeWindow $window): int
    {
        return $this->conceptMinutes($employment, $window, Computation::ReducesRequired);
    }

    private function conceptMinutes(
        Employment $employment,
        TimeWindow $window,
        Computation $computation,
        ?int $excludeConceptEntryId = null,
    ): int {
        $query = ConceptEntry::query()
            ->where('employment_id', $employment->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->whereHas('conceptType', fn (Builder $q) => $q->where('computation', $computation));

        if ($excludeConceptEntryId !== null) {
            $query->whereKeyNot($excludeConceptEntryId);
        }

        return $this->sumMinutes($query);
    }

    private function sumMinutes(Builder $query): int
    {
        return (int) $query->sum(DB::raw('TIMESTAMPDIFF(MINUTE, starts_at, ends_at)'));
    }
}
