<?php

namespace App\Services\Scheduling;

use App\Models\Assignment;
use App\Models\ConceptEntry;
use Illuminate\Support\Collection;

/**
 * Lo que ocupa el tiempo de una persona en una franja: turnos y conceptos.
 *
 * Las dos cosas ocupan a la persona físicamente. Que una cubra un puesto y la otra
 * no es irrelevante para saber si puede estar en otro sitio.
 */
final readonly class Occupations
{
    public function __construct(
        /** @var Collection<int, Assignment> */
        public Collection $assignments,
        /** @var Collection<int, ConceptEntry> */
        public Collection $conceptEntries,
    ) {}

    public function isEmpty(): bool
    {
        return $this->assignments->isEmpty() && $this->conceptEntries->isEmpty();
    }
}
