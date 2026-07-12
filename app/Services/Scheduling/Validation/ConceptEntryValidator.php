<?php

namespace App\Services\Scheduling\Validation;

use Illuminate\Support\Collection;

/** Ejecuta las reglas de CONCEPTO HORARIO. No toca la base ni bloquea nada. */
class ConceptEntryValidator
{
    /** @param  array<int, ConceptRule>  $rules */
    public function __construct(private array $rules) {}

    public function without(string $ruleClass): self
    {
        return new self(array_values(array_filter(
            $this->rules,
            fn (ConceptRule $rule) => ! $rule instanceof $ruleClass,
        )));
    }

    public function validate(ConceptEntryDraft $draft): ValidationResult
    {
        $violations = new Collection;

        foreach ($this->rules as $rule) {
            $violations = $violations->concat($rule->check($draft));
        }

        return new ValidationResult($violations);
    }
}
