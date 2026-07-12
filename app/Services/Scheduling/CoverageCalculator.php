<?php

namespace App\Services\Scheduling;

use App\Enums\Recurrence;
use App\Enums\RuleCode;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\CoverageRequirement;
use App\Services\Scheduling\Validation\Violation;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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

        // Los turnos de TODA la ventana, de una vez. Antes se consultaban dentro del
        // doble bucle (día × puesto), que es una consulta por celda: 35 para una semana
        // de 5 puestos, y 150 para un mes. Un N+1 de manual, y encima escondido detrás
        // de dos foreach.
        $shifts = $this->shiftsOf($calendar, $window);

        $segments = new Collection;
        $conflicts = $this->uncoverablePositions($company, $requirements);

        for ($date = $window->from->startOfDay(); $date->lte($window->to); $date = $date->addDay()) {
            [$effective, $overridden] = $this->effectiveOn($requirements, $date);

            $conflicts = $conflicts->concat($overridden);

            foreach ($effective->groupBy('position_id') as $forPosition) {
                $conflicts = $conflicts->concat($this->duplicatesIn($forPosition, $date));

                $segments = $segments->concat(
                    $this->segmentsFor($shifts, $company, $forPosition, $date)
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
     * Los turnos de la ventana, agrupados por celda (día|puesto).
     *
     * @return Collection<string, Collection<int, Assignment>>
     */
    private function shiftsOf(Calendar $calendar, TimeWindow $window): Collection
    {
        return Assignment::query()
            ->where('calendar_id', $calendar->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->get()
            ->groupBy(fn (Assignment $a) => CarbonImmutable::parse($a->work_date)->toDateString().'|'.$a->position_id);
    }

    /**
     * Se pide cobertura de un puesto que NADIE de la plantilla puede cubrir.
     *
     * Sin este aviso, el hueco sale como un hueco cualquiera ("faltan 2 de Sumiller") y
     * el encargado se pone a buscar a quién colocar... para descubrir que no hay nadie
     * cualificado. El problema no está en el cuadrante: está en el catálogo. Callarlo
     * es un silencio falso, porque el motor SÍ lo sabe.
     *
     * @return Collection<int, Violation>
     */
    private function uncoverablePositions(Company $company, Collection $requirements): Collection
    {
        $required = $requirements->pluck('position_id')->unique();

        if ($required->isEmpty()) {
            return new Collection;
        }

        $coverable = DB::table('employment_position')
            ->join('employments', 'employments.id', '=', 'employment_position.employment_id')
            ->where('employments.company_id', $company->id)
            ->whereNull('employments.deleted_at')
            ->whereIn('employment_position.position_id', $required)
            ->distinct()
            ->pluck('employment_position.position_id');

        return $requirements
            ->reject(fn (CoverageRequirement $r) => $coverable->contains($r->position_id))
            ->unique('position_id')
            ->map(fn (CoverageRequirement $r) => Violation::notice(
                RuleCode::UncoverablePosition,
                sprintf(
                    'Se pide cobertura de "%s", pero NADIE de la plantilla está cualificado para ese puesto.',
                    $r->position->name,
                ),
                ['position_id' => $r->position_id, 'requirement_ids' => [$r->id]],
            ))
            ->values();
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
    private function segmentsFor(Collection $allShifts, $company, Collection $forPosition, CarbonImmutable $date): Collection
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

        $shifts = ($allShifts[$date->toDateString().'|'.$position->id] ?? new Collection)
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
