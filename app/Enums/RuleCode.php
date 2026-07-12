<?php

namespace App\Enums;

/**
 * Qué regla se ha violado. La interfaz pinta según esto; el informe agrupa por esto.
 */
enum RuleCode: string
{
    // --- IMPOSIBLE ---
    /** Duración cero, o fin antes que inicio. Dato corrupto. */
    case InvalidInterval = 'invalid_interval';

    /** Más de 24h. Un día tiene 24 horas: eso no lo configura nadie. */
    case ShiftTooLong = 'shift_too_long';

    /** El turno cae fuera de la vigencia del contrato. */
    case ContractInactive = 'contract_inactive';

    /** No puede estar en dos sitios a la vez. Cruza empresas. */
    case Overlap = 'overlap';

    /** Bloqueado por una ausencia. */
    case Unavailable = 'unavailable';

    // --- INCUMPLIMIENTO ---
    /** El contrato no está cualificado para el puesto. */
    case Eligibility = 'eligibility';

    /** Se pasa del tope de horas de alguna ventana. */
    case HourLimit = 'hour_limit';

    /** Se pasa del máximo de horas por turno del perfil. */
    case ShiftLength = 'shift_length';

    /** Descanso insuficiente entre turnos. Cruza empresas. */
    case MinimumRest = 'minimum_rest';

    // --- INFORMATIVO ---
    /** Hueco de configuración: el contrato no tiene condiciones definidas. */
    case MissingProfile = 'missing_profile';

    /** Ese día ya trabaja en otra empresa: cada encargado ve solo su mitad. */
    case SharedWorkday = 'shared_workday';
}
