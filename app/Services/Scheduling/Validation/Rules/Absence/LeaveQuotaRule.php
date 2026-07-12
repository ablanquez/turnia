<?php

namespace App\Services\Scheduling\Validation\Rules\Absence;

use App\Enums\AbsenceScope;
use App\Enums\RuleCode;
use App\Services\Scheduling\LeaveQuota;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceRule;
use App\Services\Scheduling\Validation\Violation;
use App\Services\Scheduling\WindowResolver;
use App\Support\TimeWindow;

/**
 * El cupo de vacaciones, en DÍAS LABORABLES.
 *
 * Este es el punto de aplicación que le faltaba a annual_leave_days.
 *
 * Un festivo o un domingo dentro de las vacaciones no consume cupo: no ibas a
 * trabajar ese día. Y qué días son laborables lo dice la empresa, no el código.
 *
 * Las vacaciones a caballo del fin del año de cómputo se PARTEN por la frontera y
 * cada tramo consume de su año. Contarlas enteras contra el año de inicio permitiría
 * colar 40 días saltando la frontera.
 *
 * Es un MÁXIMO: 22 de 22 cumple. Y null = sin límite.
 */
class LeaveQuotaRule implements AbsenceRule
{
    public function __construct(
        private LeaveQuota $quota,
        private LimitResolver $limits,
        private WindowResolver $windows,
    ) {}

    public function check(AbsenceDraft $draft): array
    {
        if (! $draft->absenceType->consumes_leave_quota) {
            return [];
        }

        // Contradicción de configuración: el cupo vive en el perfil, y el perfil es
        // del contrato. Una ausencia de alcance persona no tiene contrato del que
        // descontar. No se consume cupo de nadie, pero el silencio sería un agujero
        // mudo: que alguien lo arregle en la configuración.
        if ($draft->scope() === AbsenceScope::Person || $draft->employment === null) {
            return [Violation::notice(
                RuleCode::QuotaScopeMismatch,
                sprintf(
                    'El tipo "%s" consume cupo de vacaciones, pero es de alcance persona: no hay contrato del que descontarlo.',
                    $draft->absenceType->name,
                ),
                ['absence_type_id' => $draft->absenceType->id],
            )];
        }

        if ($draft->isOpenEnded()) {
            return [Violation::notice(
                RuleCode::OpenEndedLeave,
                'La ausencia no tiene fecha de fin: no se puede calcular cuánto cupo consume.',
                ['absence_type_id' => $draft->absenceType->id],
            )];
        }

        $employment = $draft->employment;
        $quota = $this->limits->for($employment)->annualLeaveDays;

        if ($quota === null) {
            return []; // Sin cupo definido. No es cero.
        }

        $violations = [];

        foreach ($this->yearsTouched($draft) as $year) {
            $newDays = $this->quota->daysConsumedWithin($employment, $draft->startsOn, $draft->endsOn, $year);

            if ($newDays === 0) {
                continue;
            }

            $already = $this->quota->consumedDays($employment, $year, $draft->ignoreAbsenceId);
            $resulting = $already + $newDays;

            if ($resulting <= $quota) {
                continue;
            }

            $violations[] = Violation::breach(
                RuleCode::LeaveQuota,
                sprintf(
                    'Se pasa del cupo: quedaría en %d días laborables de un máximo de %d (año del %s al %s).',
                    $resulting,
                    $quota,
                    $year->from->format('d/m/Y'),
                    $year->to->format('d/m/Y'),
                ),
                [
                    'window_from' => $year->from->toDateString(),
                    'window_to' => $year->to->toDateString(),
                    'already_used_days' => $already,
                    'new_days' => $newDays,
                    'resulting_days' => $resulting,
                    'quota_days' => $quota,
                    'excess_days' => $resulting - $quota,
                ],
            );
        }

        return $violations;
    }

    /**
     * Los años de cómputo que toca la ausencia.
     *
     * Casi siempre uno. Si cruza la frontera del año móvil, dos: y entonces cada
     * tramo se comprueba contra el cupo de SU año.
     *
     * @return array<int, TimeWindow>
     */
    private function yearsTouched(AbsenceDraft $draft): array
    {
        $company = $draft->employment->company;

        $years = [];
        $cursor = $draft->startsOn;

        while ($cursor->lte($draft->endsOn)) {
            $window = $this->windows->computationYear($company, $cursor);
            $years[] = $window;

            $cursor = $window->to->addDay();
        }

        return $years;
    }
}
