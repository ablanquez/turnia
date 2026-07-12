<?php

namespace App\Enums;

/**
 * Cómo computa un concepto horario o una ausencia.
 *
 * El motor no conoce sectores ni convenios: no sabe qué es una "hora médica".
 * Solo sabe leer este valor, que la empresa asigna a cada elemento de su catálogo.
 */
enum Computation: string
{
    /** Suma al contador: cuenta como tiempo trabajado. */
    case Adds = 'adds';

    /** No suma, pero reduce la jornada exigible en esa ventana. */
    case ReducesRequired = 'reduces_required';

    /** Suma a un contador aparte, con su propio tope (definido en el perfil). */
    case SeparateCounter = 'separate_counter';

    /** Bloquea la disponibilidad sin computar tiempo. */
    case Blocks = 'blocks';
}
