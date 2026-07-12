<?php

namespace App\Services\Scheduling\Validation\Rules\Absence;

use App\Enums\AbsenceScope;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceRule;
use App\Services\Scheduling\Validation\Violation;
use Carbon\CarbonImmutable;

/**
 * La ausencia de un CONTRATO tiene que caer dentro de su vigencia.
 *
 * OJO A LA ASIMETRÍA: esta regla NO es la de las asignaciones copiada. Solo se aplica
 * a las ausencias de alcance EMPLOYMENT.
 *
 * - Vacaciones (alcance contrato): pedirlas para julio en un contrato que acabó en
 *   enero no significa nada. IMPOSIBLE.
 * - Baja laboral (alcance persona): PUEDE sobrevivir al contrato — te pones enfermo,
 *   tu temporal termina y la baja sigue. Y además no tiene contrato del que comprobar
 *   vigencia. Aquí no se comprueba nada.
 *
 * Copiar la regla a ciegas habría impedido registrar bajas reales.
 */
class ContractActiveRule implements AbsenceRule
{
    public function check(AbsenceDraft $draft): array
    {
        if ($draft->scope() !== AbsenceScope::Employment || $draft->employment === null) {
            return [];
        }

        $employment = $draft->employment;

        $startsOn = CarbonImmutable::parse($employment->starts_on)->startOfDay();

        // La ausencia entera tiene que caber en la vigencia: basta con que un extremo
        // se salga para que el dato no tenga sentido.
        if ($draft->startsOn->lt($startsOn)) {
            return [Violation::impossible(
                RuleCode::ContractInactive,
                sprintf('El contrato no empieza hasta el %s.', $startsOn->format('d/m/Y')),
                ['starts_on' => $startsOn->toDateString()],
            )];
        }

        if ($employment->ends_on === null) {
            return [];
        }

        $endsOn = CarbonImmutable::parse($employment->ends_on)->startOfDay();

        $lastDay = $draft->endsOn ?? $draft->startsOn;

        if ($lastDay->gt($endsOn)) {
            return [Violation::impossible(
                RuleCode::ContractInactive,
                sprintf('El contrato terminó el %s.', $endsOn->format('d/m/Y')),
                ['ends_on' => $endsOn->toDateString()],
            )];
        }

        return [];
    }
}
