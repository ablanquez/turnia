<?php

namespace App\Services\Scheduling\Validation\Rules\Assignment;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * El turno tiene que ser un turno.
 *
 * Duración cero o negativa no es un incumplimiento de convenio: es un dato
 * corrupto. Y más de 24 horas es físicamente absurdo, con perfil o sin él: "null
 * = sin límite" es un parámetro de negocio, pero un día tiene 24 horas y eso no
 * lo configura nadie.
 */
class IntervalSanityRule implements AssignmentRule
{
    public const MAX_SHIFT_MINUTES = 24 * 60;

    public function check(AssignmentDraft $draft): array
    {
        $minutes = $draft->durationMinutes();

        if ($minutes <= 0) {
            return [Violation::impossible(
                RuleCode::InvalidInterval,
                $minutes === 0
                    ? 'El turno dura cero minutos.'
                    : 'El turno termina antes de empezar.',
                ['duration_minutes' => $minutes],
            )];
        }

        if ($minutes > self::MAX_SHIFT_MINUTES) {
            return [Violation::impossible(
                RuleCode::ShiftTooLong,
                sprintf('El turno dura %d minutos: más de 24 horas seguidas.', $minutes),
                ['duration_minutes' => $minutes, 'max_minutes' => self::MAX_SHIFT_MINUTES],
            )];
        }

        return [];
    }
}
