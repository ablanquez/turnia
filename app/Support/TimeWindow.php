<?php

namespace App\Support;

use Carbon\CarbonImmutable;

/**
 * Una ventana temporal, en días locales de negocio (work_date).
 *
 * Semana, mes y año de cómputo son la MISMA cosa con distintos extremos. Por eso
 * el contador recibe una ventana y no sabe de qué tipo es.
 *
 * Ambos extremos son INCLUSIVOS.
 */
final readonly class TimeWindow
{
    public function __construct(
        public CarbonImmutable $from,
        public CarbonImmutable $to,
    ) {}

    public function contains(CarbonImmutable $date): bool
    {
        return $date->betweenIncluded($this->from, $this->to);
    }

    /** @return array{0: string, 1: string} Los extremos, listos para whereBetween. */
    public function toDateRange(): array
    {
        return [$this->from->toDateString(), $this->to->toDateString()];
    }

    public function __toString(): string
    {
        return $this->from->toDateString().' .. '.$this->to->toDateString();
    }
}
