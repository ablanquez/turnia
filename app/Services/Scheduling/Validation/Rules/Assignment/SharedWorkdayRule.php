<?php

namespace App\Services\Scheduling\Validation\Rules\Assignment;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentRule;
use App\Services\Scheduling\Validation\Violation;

/**
 * Ese día ya trabaja en OTRA empresa.
 *
 * Es la contrapartida de la regla del descanso. Como el descanso solo se exige
 * ENTRE jornadas (o toda jornada partida incumpliría), dos turnos del mismo
 * work_date en dos bares distintos no disparan nada. Y eso deja un punto ciego:
 * cada encargado cree que le está dando a María una jornada partida entera, y
 * ninguno de los dos sabe que está encadenando dos.
 *
 * No es imposible (el solape ya la protege de estar en dos sitios a la vez) y no
 * incumple ninguna condición. Pero el encargado del Bar B tiene que ENTERARSE.
 */
class SharedWorkdayRule implements AssignmentRule
{
    public function check(AssignmentDraft $draft): array
    {
        $elsewhere = Assignment::query()
            ->where('person_id', $draft->personId())
            ->where('work_date', $draft->workDate->toDateString())
            ->where('company_id', '!=', $draft->employment->company_id)
            ->when($draft->ignoreAssignmentId, fn ($q, $id) => $q->whereKeyNot($id))
            ->with('company')
            ->get();

        if ($elsewhere->isEmpty()) {
            return [];
        }

        $companies = $elsewhere->pluck('company.name')->unique();

        return [Violation::notice(
            RuleCode::SharedWorkday,
            sprintf(
                'Ese día también trabaja en %s (%s).',
                $companies->join(', ', ' y '),
                // La hora, en el reloj de LA OTRA empresa: es donde ocurre el turno. Si
                // el otro bar estuviera en Canarias, decir la hora de Madrid sería
                // mentir con precisión.
                $elsewhere->map(
                    fn (Assignment $a) => $a->company->localTime($a->starts_at)
                        .'-'.$a->company->localTime($a->ends_at)
                )->join(', '),
            ),
            [
                'company_ids' => $elsewhere->pluck('company_id')->unique()->values()->all(),
                'assignment_ids' => $elsewhere->pluck('id')->all(),
            ],
        )];
    }
}
