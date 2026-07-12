<?php

namespace App\Services\Scheduling\Validation;

/**
 * Una regla sabe UNA cosa.
 *
 * Están detrás de una interfaz para poder montar el validador con un subconjunto:
 * así se puede desactivar una sola regla y demostrar que sin ella el dato inválido
 * pasa. Si las cinco vivieran en un método de 200 líneas, esa contraprueba no se
 * podría escribir.
 */
interface Rule
{
    /** @return array<int, Violation> */
    public function check(AssignmentDraft $draft): array;
}
