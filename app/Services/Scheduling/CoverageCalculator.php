<?php

namespace App\Services\Scheduling;

use App\Enums\Recurrence;
use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\CoverageRequirement;
use App\Services\Scheduling\Validation\Violation;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * "Hacen falta 3 de barra" contra "hay 2 colocados".
 *
 * DOS DECISIONES GOBIERNAN ESTA CLASE:
 *
 * 1. PRECEDENCIA date > weekly > daily, por (fecha, puesto). Un requisito de fecha
 *    concreta ANULA los recurrentes de ese día para ese puesto. Sin esto, el bar que
 *    cierra el 25 de diciembre (que cae en sábado) enseñaría un hueco fantasma de 3
 *    personas un día que ni abre, y el encargado aprendería a ignorar los huecos.
 *    Con la precedencia, required_count = 0 significa "cerrado", sin columna nueva.
 *
 * 2. COBERTURA POR SEGMENTOS. El día se parte por los bordes de requisitos y turnos,
 *    y cada tramo se evalúa aparte. Un turno de 12 a 14 frente a un requisito de 12 a
 *    16 no es "cubierto" ni "vacío": es "de 12 a 14 faltan 2, de 14 a 16 faltan 3".
 *    Pintar el agujero DONDE ESTÁ es lo que lo hace accionable.
 *
 * Los requisitos que se pisan NO se fusionan: cada uno es una demanda independiente.
 * "3 de 12 a 16" y "2 de 14 a 18" es un escalonamiento normal, y de 14 a 16 hacen
 * falta 5. Solo el duplicado exacto se denuncia como error de configuración.
 */
class CoverageCalculator
{
    public function forCalendar(Calendar $calendar, TimeWindow $window): CoverageReport
    {
        $company = $calendar->company;
        $requirements = $this->requirementsOf($calendar);

        $segments = new Collection;
        $conflicts = new Collection;

        for ($date = $window->from->startOfDay(); $date->lte($window->to); $date = $date->addDay()) {
            [$effective, $overridden] = $this->effectiveOn($requirements, $date);

            $conflicts = $conflicts->concat($overridden);

            foreach ($effective->groupBy('position_id') as $forPosition) {
                $conflicts = $conflicts->concat($this->duplicatesIn($forPosition, $date));

                $segments = $segments->concat(
                    $this->segmentsFor($calendar, $company, $forPosition, $date)
                );
            }
        }

        return new CoverageReport(
            $segments->filter(fn (CoverageSegment $s) => $s->required !== $s->covered)->values(),
            $conflicts,
        );
    }

    /** @return Collection<int, CoverageRequirement> */
    private function requirementsOf(Calendar $calendar): Collection
    {
        return CoverageRequirement::query()
            ->where('calendar_id', $calendar->id)
            ->with('position')
            ->get();
    }

    /**
     * Los requisitos vigentes ese día, ya resuelta la precedencia, y los avisos de lo
     * que se ha anulado por el camino.
     *
     * El aviso NO es decorativo. La precedencia sustituye, no completa: si añades un
     * requisito de fecha para un turno de noche extra, ese día DESAPARECE la demanda
     * semanal del mediodía. Y una demanda que desaparece en silencio es peor que un
     * hueco fantasma: el encargado ve "cubierto" y el bar se queda sin barra a la hora
     * de comer. Aquí se hace ruidoso.
     *
     * @return array{0: Collection<int, CoverageRequirement>, 1: Collection<int, Violation>}
     */
    private function effectiveOn(Collection $requirements, CarbonImmutable $date): array
    {
        $inForce = $requirements->filter(function (CoverageRequirement $r) use ($date) {
            $from = CarbonImmutable::parse($r->effective_from)->startOfDay();

            if ($date->lt($from)) {
                return false;
            }

            if ($r->effective_to !== null && $date->gt(CarbonImmutable::parse($r->effective_to)->startOfDay())) {
                return false;
            }

            return match ($r->recurrence) {
                Recurrence::Daily => true,
                Recurrence::Weekly => $r->day_of_week === $date->dayOfWeekIso,
                Recurrence::Date => $r->on_date !== null
                    && CarbonImmutable::parse($r->on_date)->isSameDay($date),
            };
        });

        $effective = new Collection;
        $notices = new Collection;

        // La precedencia se resuelve por PUESTO: el 25 de diciembre puede cerrar la
        // barra y dejar la cocina con su horario normal.
        foreach ($inForce->groupBy('position_id') as $forPosition) {
            foreach ([Recurrence::Date, Recurrence::Weekly, Recurrence::Daily] as $level) {
                $atLevel = $forPosition->where('recurrence', $level);

                if ($atLevel->isEmpty()) {
                    continue;
                }

                $effective = $effective->concat($atLevel);
                $discarded = $forPosition->where('recurrence', '!=', $level);

                if ($discarded->isNotEmpty()) {
                    $notices->push($this->overriddenNotice($atLevel, $discarded, $date));
                }

                break;
            }
        }

        return [$effective, $notices];
    }

    private function overriddenNotice(Collection $winning, Collection $discarded, CarbonImmutable $date): Violation
    {
        return Violation::notice(
            RuleCode::RequirementOverridden,
            sprintf(
                'El %s, el requisito de %s para "%s" anula %d requisito(s) recurrente(s): '.
                'la demanda de esas franjas desaparece ese día. Si sigue haciendo falta, hay que redeclararla.',
                $date->format('d/m/Y'),
                $winning->first()->recurrence->value,
                $winning->first()->position->name,
                $discarded->count(),
            ),
            [
                'date' => $date->toDateString(),
                'position_id' => $winning->first()->position_id,
                'winning_ids' => $winning->pluck('id')->all(),
                'overridden_ids' => $discarded->pluck('id')->all(),
            ],
        );
    }

    /** Dos requisitos idénticos doblarían la demanda sin que nadie lo hubiera querido. */
    private function duplicatesIn(Collection $forPosition, CarbonImmutable $date): Collection
    {
        return $forPosition
            ->groupBy(fn (CoverageRequirement $r) => $r->starts_at.'-'.$r->ends_at)
            ->filter(fn (Collection $group) => $group->count() > 1)
            ->map(fn (Collection $group) => Violation::notice(
                RuleCode::DuplicateRequirement,
                sprintf(
                    'El %s hay %d requisitos idénticos para "%s" de %s a %s: la demanda se está doblando.',
                    $date->format('d/m/Y'),
                    $group->count(),
                    $group->first()->position->name,
                    $group->first()->starts_at,
                    $group->first()->ends_at,
                ),
                [
                    'date' => $date->toDateString(),
                    'position_id' => $group->first()->position_id,
                    'requirement_ids' => $group->pluck('id')->all(),
                ],
            ))
            ->values();
    }

    /**
     * El corazón: partir el día por los bordes y evaluar cada tramo.
     *
     * @return Collection<int, CoverageSegment>
     */
    private function segmentsFor(Calendar $calendar, $company, Collection $forPosition, CarbonImmutable $date): Collection
    {
        $position = $forPosition->first()->position;

        // Las franjas de los requisitos son horas LOCALES: se convierten a instantes
        // UTC. Si la franja acaba antes de empezar, cruza medianoche.
        $demands = $forPosition->map(function (CoverageRequirement $r) use ($company, $date) {
            $startsAt = $company->toUtc($date->toDateString(), (string) $r->starts_at);
            $endsAt = $company->toUtc($date->toDateString(), (string) $r->ends_at);

            if ($endsAt->lte($startsAt)) {
                $endsAt = $company->toUtc($date->addDay()->toDateString(), (string) $r->ends_at);
            }

            return ['from' => $startsAt, 'to' => $endsAt, 'count' => $r->required_count];
        });

        $shifts = Assignment::query()
            ->where('calendar_id', $calendar->id)
            ->where('position_id', $position->id)
            ->where('work_date', $date->toDateString())
            ->get()
            ->map(fn (Assignment $a) => [
                'from' => CarbonImmutable::parse($a->starts_at),
                'to' => CarbonImmutable::parse($a->ends_at),
            ]);

        $boundaries = $demands->concat($shifts)
            ->flatMap(fn (array $i) => [$i['from'], $i['to']])
            ->unique(fn (CarbonImmutable $t) => $t->getTimestamp())
            ->sortBy(fn (CarbonImmutable $t) => $t->getTimestamp())
            ->values();

        $segments = new Collection;

        for ($i = 0; $i < $boundaries->count() - 1; $i++) {
            $from = $boundaries[$i];
            $to = $boundaries[$i + 1];

            // Demandas independientes: en un tramo se SUMAN. "3 de 12 a 16" más
            // "2 de 14 a 18" hacen 5 personas entre las 14 y las 16.
            $required = $demands
                ->filter(fn (array $d) => $d['from']->lte($from) && $d['to']->gte($to))
                ->sum('count');

            $covered = $shifts
                ->filter(fn (array $s) => $s['from']->lte($from) && $s['to']->gte($to))
                ->count();

            if ($required === 0 && $covered === 0) {
                continue;
            }

            $segments->push(new CoverageSegment(
                position: $position,
                workDate: $date,
                startsAt: $from,
                endsAt: $to,
                required: (int) $required,
                covered: $covered,
            ));
        }

        return $this->merge($segments);
    }

    /**
     * Une tramos contiguos con el mismo balance.
     *
     * Sin esto, un turno que empieza en mitad de la franja parte el hueco en dos
     * trozos idénticos y la parrilla pintaría dos agujeros donde hay uno.
     *
     * @return Collection<int, CoverageSegment>
     */
    private function merge(Collection $segments): Collection
    {
        $merged = new Collection;

        foreach ($segments as $segment) {
            $last = $merged->last();

            $continuous = $last !== null
                && $last->endsAt->equalTo($segment->startsAt)
                && $last->required === $segment->required
                && $last->covered === $segment->covered;

            if ($continuous) {
                $merged->pop();
                $merged->push(new CoverageSegment(
                    position: $segment->position,
                    workDate: $segment->workDate,
                    startsAt: $last->startsAt,
                    endsAt: $segment->endsAt,
                    required: $segment->required,
                    covered: $segment->covered,
                ));

                continue;
            }

            $merged->push($segment);
        }

        return $merged;
    }
}
