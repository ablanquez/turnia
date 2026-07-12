<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;

/**
 * ¿Puede el contrato cubrir ese puesto? (pivote employment_position)
 *
 * Es INCUMPLIMIENTO, no imposible: poner al de almacén en la barra un sábado de
 * agosto es una mala idea, pero el encargado puede necesitar hacerlo. Avisa y deja.
 */
class EligibilityRule implements Rule
{
    public function check(AssignmentDraft $draft): array
    {
        $qualified = $draft->employment
            ->positions()
            ->whereKey($draft->position->id)
            ->exists();

        if ($qualified) {
            return [];
        }

        return [Violation::breach(
            RuleCode::Eligibility,
            sprintf('No está cualificado para el puesto "%s".', $draft->position->name),
            ['position_id' => $draft->position->id],
        )];
    }
}
