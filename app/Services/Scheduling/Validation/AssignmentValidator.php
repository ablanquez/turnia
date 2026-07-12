<?php

namespace App\Services\Scheduling\Validation;

use Illuminate\Support\Collection;

/**
 * Ejecuta las reglas y agrega el resultado.
 *
 * NO toca la base y NO bloquea nada: devuelve el resultado con su gravedad y la
 * capa que escribe decide. Por eso el mismo motor sirve para la parrilla, para el
 * informe y para un futuro simulador.
 *
 * Las reglas se inyectan: montar el validador con un subconjunto es lo que permite
 * la contraprueba (desactivar una regla y demostrar que sin ella el dato pasa).
 */
class AssignmentValidator
{
    /** @param  array<int, Rule>  $rules */
    public function __construct(private array $rules) {}

    /** @param  array<int, Rule>  $rules */
    public function withOnly(array $rules): self
    {
        return new self($rules);
    }

    /** Quita una regla concreta. Es la herramienta de la contraprueba. */
    public function without(string $ruleClass): self
    {
        return new self(array_values(array_filter(
            $this->rules,
            fn (Rule $rule) => ! $rule instanceof $ruleClass,
        )));
    }

    public function validate(AssignmentDraft $draft): ValidationResult
    {
        $violations = new Collection;

        foreach ($this->rules as $rule) {
            $violations = $violations->concat($rule->check($draft));
        }

        return new ValidationResult($violations);
    }
}
