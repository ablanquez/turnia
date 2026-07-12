<?php

namespace App\Services\Scheduling\Validation;

use App\Enums\RuleCode;
use App\Enums\Severity;
use Illuminate\Support\Collection;

/**
 * El resultado de validar. Objeto rico, no un booleano.
 *
 * El motor NO bloquea: devuelve esto y la capa que escribe decide. Por eso el
 * mismo motor sirve para la parrilla, para el informe y para un simulador.
 */
final readonly class ValidationResult
{
    /** @param  Collection<int, Violation>  $violations */
    public function __construct(public Collection $violations) {}

    /** @return Collection<int, Violation> */
    public function impossibles(): Collection
    {
        return $this->violations->where('severity', Severity::Impossible)->values();
    }

    /** @return Collection<int, Violation> */
    public function breaches(): Collection
    {
        return $this->violations->where('severity', Severity::Breach)->values();
    }

    /** Informativos: ni imposibles ni incumplimientos, pero hay que enterarse. */
    public function notices(): Collection
    {
        return $this->violations->where('severity', Severity::Notice)->values();
    }

    /** Físicamente colocable. Puede ser posible Y estar incumpliendo el convenio. */
    public function isPossible(): bool
    {
        return $this->impossibles()->isEmpty();
    }

    public function isClean(): bool
    {
        return $this->violations->isEmpty();
    }

    public function has(RuleCode $code): bool
    {
        return $this->violations->contains(fn (Violation $v) => $v->code === $code);
    }

    public function toArray(): array
    {
        return $this->violations->map(fn (Violation $v) => $v->toArray())->all();
    }
}
