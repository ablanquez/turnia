<?php

namespace App\Services\Scheduling;

use App\Services\Scheduling\Validation\Violation;
use Illuminate\Support\Collection;

/**
 * El resultado de comparar lo que hace falta con lo que hay.
 *
 * `segments` son TODOS los tramos, incluidos los que están CORRECTOS.
 *
 * Antes solo salían las desviaciones, y sonaba razonable —"solo interesa lo que está
 * mal"—, pero era un silencio falso dibujado: sin los tramos correctos la parrilla no
 * puede pintar el verde, y entonces el gris significa a la vez "esto está cubierto" y
 * "aquí no se pide nada". Dos cosas opuestas, el mismo color.
 *
 * `conflicts` son errores de CONFIGURACIÓN (requisitos duplicados, puestos que nadie de la
 * plantilla puede cubrir): el problema no está en el cuadrante, está en el catálogo.
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

    /** Lo que NO cuadra. Es lo único que salía antes del motor. */
    public function deviations(): Collection
    {
        return $this->segments
            ->filter(fn (CoverageSegment $s) => $s->required !== $s->covered)
            ->values();
    }

    /** Lo que SÍ cuadra. Es lo que faltaba, y es lo que se pinta en verde. */
    public function covered(): Collection
    {
        return $this->segments
            ->filter(fn (CoverageSegment $s) => $s->required > 0 && $s->required === $s->covered)
            ->values();
    }

    public function isFullyCovered(): bool
    {
        return $this->gaps()->isEmpty();
    }
}
