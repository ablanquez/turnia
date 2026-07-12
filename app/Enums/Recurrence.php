<?php

namespace App\Enums;

/**
 * Cada cuánto se repite un requisito de cobertura dentro de su ventana de vigencia.
 */
enum Recurrence: string
{
    /** Todos los días de la ventana. */
    case Daily = 'daily';

    /** Un día concreto de la semana (day_of_week, ISO 1-7). */
    case Weekly = 'weekly';

    /** Una fecha suelta (on_date). */
    case Date = 'date';
}
