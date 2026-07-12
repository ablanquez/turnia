<?php

namespace App\Services\Scheduling\Validation\Rules\Assignment;

use App\Enums\RuleCode;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * El contrato no tiene perfil: no se le aplica ningún límite.
 *
 * Coherente con "null = sin límite", pero el encargado tiene que ENTERARSE. Es un
 * hueco de configuración, no un incumplimiento de convenio: el silencio no es lo
 * mismo que "todo correcto".
 */
class ProfileDefinedRule implements AssignmentRule
{
    public function __construct(private LimitResolver $limits) {}

    public function check(AssignmentDraft $draft): array
    {
        if ($this->limits->for($draft->employment)->hasProfile) {
            return [];
        }

        // Informativo, no incumplimiento: no rompe ningún convenio, es que no hay
        // convenio que romper. Pero el encargado tiene que enterarse.
        return [Violation::notice(
            RuleCode::MissingProfile,
            'Este contrato no tiene condiciones definidas: no se le aplica ningún límite de horas.',
            ['employment_id' => $draft->employment->id],
        )];
    }
}
