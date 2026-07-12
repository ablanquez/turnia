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

    /** El perfil solo admite jornada continua y ese día ya hay otro turno. */
    case WorkdayType = 'workday_type';

    /** Se pasa del tope de horas extra (el contador aparte). */
    case OvertimeLimit = 'overtime_limit';

    /** Se pasa del cupo de vacaciones, medido en días laborables. */
    case LeaveQuota = 'leave_quota';

    /** Se solapa con otra ausencia. Avisa, pero deja registrar: una baja puede caer
     *  encima de unas vacaciones, y prohibirlo obligaría a borrar las vacaciones. */
    case AbsenceOverlap = 'absence_overlap';

    // --- IMPOSIBLE (ausencias) ---
    /** Fecha de fin anterior a la de inicio. */
    case InvalidDateRange = 'invalid_date_range';

    /** Ya existe una ausencia idéntica y solapada del mismo tipo. */
    case DuplicateAbsence = 'duplicate_absence';

    // --- INFORMATIVO ---
    /** Hueco de configuración: el contrato no tiene condiciones definidas. */
    case MissingProfile = 'missing_profile';

    /** Ese día ya trabaja en otra empresa: cada encargado ve solo su mitad. */
    case SharedWorkday = 'shared_workday';

    /** Esta baja pisa días de vacaciones ya cogidas: revisa si hay que devolverlos. */
    case LeaveOverlappedByBlocking = 'leave_overlapped_by_blocking';

    /** El tipo consume cupo pero es de alcance persona: contradicción de configuración. */
    case QuotaScopeMismatch = 'quota_scope_mismatch';

    /** Esta ausencia deja asignaciones futuras al descubierto. */
    case OrphanedAssignments = 'orphaned_assignments';

    /** La ausencia no tiene fecha de fin: no se puede calcular el cupo que consume. */
    case OpenEndedLeave = 'open_ended_leave';

    /** Dos requisitos de cobertura idénticos: la demanda se está doblando. */
    case DuplicateRequirement = 'duplicate_requirement';

    /** Un requisito de fecha ha anulado a los recurrentes de ese día: revisa las franjas. */
    case RequirementOverridden = 'requirement_overridden';

    /** Se pide cobertura de un puesto que NADIE de la plantilla puede cubrir. */
    case UncoverablePosition = 'uncoverable_position';
}
