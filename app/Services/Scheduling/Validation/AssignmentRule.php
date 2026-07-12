<?php

namespace App\Services\Scheduling\Validation;

/**
 * Una regla sabe UNA cosa sobre una ASIGNACIÓN.
 *
 * Hay una interfaz por tipo de borrador (asignación, concepto, ausencia) en vez de
 * una sola que reciba `mixed`: el tipado es lo que impide que una regla de ausencias
 * acabe recibiendo una asignación.
 *
 * Están detrás de una interfaz para poder montar el validador con un subconjunto:
 * así se puede desactivar una sola regla y demostrar que sin ella el dato inválido
 * pasa. Si todas vivieran en un método de 200 líneas, esa contraprueba no se podría
 * escribir.
 */
interface AssignmentRule
{
    /** @return array<int, Violation> */
    public function check(AssignmentDraft $draft): array;
}
