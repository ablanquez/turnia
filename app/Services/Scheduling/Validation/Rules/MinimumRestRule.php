<?php

namespace App\Services\Scheduling\Validation\Rules;

use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\Rule;
use App\Services\Scheduling\Validation\Violation;

/**
 * Descanso mínimo entre turnos.
 *
 * A NIVEL DE PERSONA, CRUZANDO EMPRESAS. El descanso es fisiológico y legal:
 * María no descansa el doble por tener dos contratos. Si cierra el Bar A a las
 * 2:00 y su perfil del Bar B exige 12h, no puede entrar a las 9:00 en el Bar B.
 *
 * El límite es un MÍNIMO: un descanso de exactamente 12h con un perfil que pide
 * 12h CUMPLE. Se incumple por debajo.
 *
 * Se mide contra el turno anterior Y el siguiente: colocar un turno puede romper
 * el descanso del que ya venía detrás.
 */
class MinimumRestRule implements Rule
{
    public function __construct(private LimitResolver $limits) {}

    public function check(AssignmentDraft $draft): array
    {
        $minRest = $this->limits->for($draft->employment)->minRestMinutesBetweenShifts;

        if ($minRest === null) {
            return []; // Sin límite. No es cero.
        }

        if ($draft->durationMinutes() <= 0) {
            return []; // Intervalo corrupto: lo caza IntervalSanityRule.
        }

        $violations = [];

        $previous = $this->neighbours($draft)
            ->where('ends_at', '<=', $draft->startsAt)
            ->orderByDesc('ends_at')
            ->first();

        if ($previous !== null) {
            $gap = intdiv($draft->startsAt->getTimestamp() - $previous->ends_at->getTimestamp(), 60);

            if ($gap < $minRest) {
                $violations[] = $this->violation($gap, $minRest, $previous, 'anterior');
            }
        }

        $next = $this->neighbours($draft)
            ->where('starts_at', '>=', $draft->endsAt)
            ->orderBy('starts_at')
            ->first();

        if ($next !== null) {
            $gap = intdiv($next->starts_at->getTimestamp() - $draft->endsAt->getTimestamp(), 60);

            if ($gap < $minRest) {
                $violations[] = $this->violation($gap, $minRest, $next, 'siguiente');
            }
        }

        return $violations;
    }

    /**
     * Todos los turnos de la PERSONA, en cualquier empresa, de OTRA jornada.
     *
     * El descanso es ENTRE jornadas, no dentro de una. Una jornada partida (9-13 y
     * 17-21) es UNA jornada con un hueco en medio, y sus dos mitades comparten
     * work_date: entre ellas no se exige descanso, o toda partida incumpliría y el
     * motor sería inútil en hostelería.
     *
     * Cruza empresas igualmente: dos turnos en dos bares el mismo día son la misma
     * jornada de la misma persona; en días distintos, el descanso se exige.
     */
    private function neighbours(AssignmentDraft $draft)
    {
        return Assignment::query()
            ->where('person_id', $draft->personId())
            ->where('work_date', '!=', $draft->workDate->toDateString())
            ->when($draft->ignoreAssignmentId, fn ($q, $id) => $q->whereKeyNot($id))
            ->with('company');
    }

    private function violation(int $gap, int $minRest, Assignment $other, string $which): Violation
    {
        return Violation::breach(
            RuleCode::MinimumRest,
            sprintf(
                'Solo descansa %s respecto al turno %s en %s, y el mínimo es %s.',
                $this->hours($gap),
                $which,
                $other->company->name,
                $this->hours($minRest),
            ),
            [
                'rest_minutes' => $gap,
                'required_minutes' => $minRest,
                'against_assignment_id' => $other->id,
                'against_company_id' => $other->company_id,
            ],
        );
    }

    private function hours(int $minutes): string
    {
        return sprintf('%dh %02dmin', intdiv($minutes, 60), $minutes % 60);
    }
}
