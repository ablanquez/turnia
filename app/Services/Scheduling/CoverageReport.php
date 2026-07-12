<?php

namespace App\Services\Scheduling;

use App\Services\Scheduling\Validation\Violation;
use Illuminate\Support\Collection;

/**
 * El resultado de comparar lo que hace falta con lo que hay.
 *
 * `conflicts` son errores de CONFIGURACIÓN (requisitos duplicados), no de la
 * parrilla: la demanda se doblaría sin que nadie lo hubiera querido.
 */
final readonly class CoverageReport
{
    public function __construct(
        /** @var Collection<int, CoverageSegment> */
        public Collection $segments,
        /** @var Collection<int, Violation> */
        public Collection $conflicts,
    ) {}

    /** @return Collection<int, CoverageSegment> */
    public function gaps(): Collection
    {
        return $this->segments->filter(fn (CoverageSegment $s) => $s->isGap())->values();
    }

    /** @return Collection<int, CoverageSegment> */
    public function excesses(): Collection
    {
        return $this->segments->filter(fn (CoverageSegment $s) => $s->isExcess())->values();
    }

    public function isFullyCovered(): bool
    {
        return $this->gaps()->isEmpty();
    }
}
