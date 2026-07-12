<?php

namespace App\Services\Scheduling\Validation;

use Illuminate\Support\Collection;

/** Ejecuta las reglas de AUSENCIA. No toca la base ni bloquea nada. */
class AbsenceValidator
{
    /** @param  array<int, AbsenceRule>  $rules */
    public function __construct(private array $rules) {}

    public function without(string $ruleClass): self
    {
        return new self(array_values(array_filter(
            $this->rules,
            fn (AbsenceRule $rule) => ! $rule instanceof $ruleClass,
        )));
    }

    public function validate(AbsenceDraft $draft): ValidationResult
    {
        $violations = new Collection;

        foreach ($this->rules as $rule) {
            $violations = $violations->concat($rule->check($draft));
        }

        return new ValidationResult($violations);
    }
}
