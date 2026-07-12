<?php

namespace App\Services\Scheduling;

use App\Models\Position;
use Carbon\CarbonImmutable;

/**
 * Un tramo de tiempo con su demanda y su cobertura real.
 *
 * "De 12:00 a 14:00 hacen falta 3 de barra y hay 1: faltan 2."
 *
 * El día se parte por los bordes de los turnos y de los requisitos, y cada tramo se
 * evalúa por separado. Es más caro que mirar la franja entera, pero es lo único que
 * no miente: un turno de 12 a 14 no cubre una franja de 12 a 16, y decir que faltan
 * 3 en toda la tarde sería un aviso falso — el veneno que ya conocemos.
 */
final readonly class CoverageSegment
{
    public function __construct(
        public Position $position,
        public CarbonImmutable $workDate,
        public CarbonImmutable $startsAt,
        public CarbonImmutable $endsAt,
        public int $required,
        public int $covered,
    ) {}

    /** Cuánta gente falta. Cero si está cubierto o sobra. */
    public function missing(): int
    {
        return max(0, $this->required - $this->covered);
    }

    /** Cuánta gente sobra. También es información útil. */
    public function excess(): int
    {
        return max(0, $this->covered - $this->required);
    }

    public function isGap(): bool
    {
        return $this->missing() > 0;
    }

    public function isExcess(): bool
    {
        return $this->excess() > 0;
    }
}
