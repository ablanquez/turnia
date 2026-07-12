<?php

namespace App\Services\Scheduling\Presentation;

use App\Enums\Computation;
use App\Models\Absence;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\ConceptEntry;
use App\Models\Employment;
use App\Models\Holiday;
use App\Models\Person;
use App\Services\Scheduling\CoverageCalculator;
use App\Services\Scheduling\CoverageReport;
use App\Services\Scheduling\CoverageSegment;
use App\Services\Scheduling\HourCounter;
use App\Services\Scheduling\LimitResolver;
use App\Services\Scheduling\ReportedViolation;
use App\Services\Scheduling\ViolationReport;
use App\Services\Scheduling\WorkdayCalendar;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Lo que la parrilla necesita saber, y NADA de lo que no le corresponde.
 *
 * Aquí no se calcula ninguna regla: todo sale de los servicios que ya existen. Esta
 * clase solo hace tres cosas, y las tres importan:
 *
 *   1. POSICIONA en el eje temporal (TimeAxis), en el servidor, para que el
 *      navegador no tenga que tocar una fecha en su vida.
 *   2. RECORTA según quién mira (ScheduleScope): las bajas y los conceptos de los
 *      compañeros no salen de aquí ni por accidente.
 *   3. REDACTA lo que el motor sabe pero la pantalla no puede decir
 *      (ViolationRedactor).
 *
 * El informe de incumplimientos NO está en la carga: se sirve aparte (violations()),
 * como prop diferida. Cuesta ~700 ms la semana, y meterlo aquí haría que la página
 * tardara un segundo en aparecer.
 */
class SchedulePayload
{
    public function __construct(
        private HourCounter $counter,
        private LimitResolver $limits,
        private WorkdayCalendar $workdays,
        private CoverageCalculator $coverageCalculator,
        private ViolationReport $report,
    ) {}

    public function build(Calendar $calendar, TimeWindow $window, ScheduleScope $scope): array
    {
        $company = $calendar->company;

        $assignments = $this->assignments($calendar, $window);
        $concepts = $this->conceptEntries($company, $window, $scope);
        $absences = $this->absences($company, $window, $scope);
        $coverage = $this->coverageCalculator->forCalendar($calendar, $window);

        $axis = $this->axisFor($company, $assignments, $concepts, $coverage->segments);

        return [
            'company' => [
                'id' => $company->id,
                'name' => $company->name,
                'timezone' => $company->timezone,
            ],
            'calendar' => [
                'id' => $calendar->id,
                'name' => $calendar->name,
            ],
            'window' => $this->window($company, $window),
            'axis' => $axis->toArray(),
            'positions' => $this->positions($calendar),
            'people' => $this->people($assignments, $concepts, $absences),
            'assignments' => $this->assignmentRows($assignments, $company, $axis),
            'conceptEntries' => $this->conceptRows($concepts, $company, $axis),
            'absences' => $this->absenceRows($absences),
            'coverage' => $this->coverage($coverage, $company, $axis),
            'staff' => $scope->seesStaffPanel()
                ? $this->staff($calendar, $window, $company)
                : [],
            'can' => [
                'manage' => $scope->canManage,
                'seeStaff' => $scope->seesStaffPanel(),
            ],
        ];
    }

    /**
     * LA PARTE CARA. Se sirve como prop DIFERIDA de Inertia, nunca en la carga.
     *
     * Se re-valida todo lo que hay en la ventana: los turnos, los conceptos y las
     * ausencias. Es exactamente lo que mide 719 ms la semana en el mundo de estrés,
     * y es el precio de DERIVAR los incumplimientos en vez de guardarlos — que es
     * justo lo que impide que mientan.
     */
    public function violations(Company $company, TimeWindow $window, ScheduleScope $scope): array
    {
        $redactor = new ViolationRedactor($scope);

        $rows = $this->report->forCompany($company, $window)
            ->filter(fn (ReportedViolation $row) => $this->visible($row, $scope));

        $grouped = [
            'assignment' => [],
            'concept_entry' => [],
            'absence' => [],
        ];

        foreach ($rows as $row) {
            $grouped[$row->kind][$row->subject->getKey()] = $redactor->apply($row->result);
        }

        return [
            'assignments' => (object) $grouped['assignment'],
            'conceptEntries' => (object) $grouped['concept_entry'],
            'absences' => (object) $grouped['absence'],
        ];
    }

    /**
     * El empleado ve SUS incumplimientos, no los de sus compañeros.
     *
     * "Sara lleva 41 horas de 40" es una conversación entre Sara y su encargado. Si
     * la app se la cuenta a toda la plantilla, la app se convierte en un problema.
     */
    private function visible(ReportedViolation $row, ScheduleScope $scope): bool
    {
        if ($scope->canManage) {
            return true;
        }

        return $row->subject->person_id === $scope->viewerPersonId;
    }

    /** @return Collection<int, Assignment> */
    private function assignments(Calendar $calendar, TimeWindow $window): Collection
    {
        return Assignment::query()
            ->where('calendar_id', $calendar->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->with(['position', 'person', 'override'])
            ->orderBy('work_date')
            ->orderBy('starts_at')
            ->get();
    }

    /** @return Collection<int, ConceptEntry> */
    private function conceptEntries(Company $company, TimeWindow $window, ScheduleScope $scope): Collection
    {
        return ConceptEntry::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            // El recorte va en el WHERE, no en un filter() posterior: lo que no sale
            // de la base de datos no se puede filtrar mal más adelante.
            ->unless($scope->canManage, fn ($q) => $q->where('person_id', $scope->viewerPersonId ?? 0))
            ->with(['conceptType', 'person'])
            ->orderBy('work_date')
            ->get();
    }

    /** @return Collection<int, Absence> */
    private function absences(Company $company, TimeWindow $window, ScheduleScope $scope): Collection
    {
        return Absence::query()
            ->where('company_id', $company->id)
            ->where('starts_on', '<=', $window->to->toDateString())
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $window->from->toDateString()))
            ->unless($scope->canManage, fn ($q) => $q->where('person_id', $scope->viewerPersonId ?? 0))
            ->with(['absenceType', 'person'])
            ->orderBy('starts_on')
            ->get();
    }

    /** El eje se ensancha para que quepa TODO. Recortar una barra sería dibujar una mentira. */
    private function axisFor(Company $company, Collection $assignments, Collection $concepts, Collection $segments): TimeAxis
    {
        $hours = [];

        foreach ($assignments->concat($concepts) as $row) {
            $workDate = CarbonImmutable::parse($row->work_date);
            $hours[] = TimeAxis::hourOf(CarbonImmutable::parse($row->starts_at), $workDate, $company);
            $hours[] = TimeAxis::hourOf(CarbonImmutable::parse($row->ends_at), $workDate, $company);
        }

        foreach ($segments as $segment) {
            $hours[] = TimeAxis::hourOf($segment->startsAt, $segment->workDate, $company);
            $hours[] = TimeAxis::hourOf($segment->endsAt, $segment->workDate, $company);
        }

        return TimeAxis::covering($hours);
    }

    private function window(Company $company, TimeWindow $window): array
    {
        $holidays = Holiday::query()
            ->where('company_id', $company->id)
            ->whereBetween('date', $window->toDateRange())
            ->get()
            ->keyBy(fn (Holiday $h) => CarbonImmutable::parse($h->date)->toDateString());

        $days = [];

        for ($date = $window->from; $date->lte($window->to); $date = $date->addDay()) {
            $key = $date->toDateString();

            $days[] = [
                'date' => $key,
                'weekday' => $this->weekdayName($date),
                'label' => $date->day.' '.$this->monthName($date),
                'isWorkingDay' => $this->workdays->isWorkingDay($company, $date),
                'holiday' => $holidays->get($key)?->name,
            ];
        }

        return [
            'from' => $window->from->toDateString(),
            'to' => $window->to->toDateString(),
            'isoWeek' => $window->from->isoWeek(),
            'label' => $this->rangeLabel($window),
            'previous' => $window->from->subWeek()->toDateString(),
            'next' => $window->from->addWeek()->toDateString(),
            'days' => $days,
        ];
    }

    private function positions(Calendar $calendar): array
    {
        return $calendar->company->positions()
            ->where('is_active', true)
            ->orderBy('id')
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
            ])
            ->all();
    }

    /** Los que salen pintados, con su color estable. */
    private function people(Collection ...$sources): array
    {
        return collect($sources)
            ->flatten(1)
            ->pluck('person')
            ->filter()
            ->unique('id')
            ->map(fn (Person $p) => [
                'id' => $p->id,
                'name' => trim($p->first_name.' '.$p->last_name),
                'initials' => PersonPalette::initials($p->first_name, $p->last_name),
                'color' => PersonPalette::for($p->id),
            ])
            ->values()
            ->all();
    }

    private function assignmentRows(Collection $assignments, Company $company, TimeAxis $axis): array
    {
        return $assignments->map(function (Assignment $a) use ($company, $axis) {
            $workDate = CarbonImmutable::parse($a->work_date);
            $from = TimeAxis::hourOf(CarbonImmutable::parse($a->starts_at), $workDate, $company);
            $to = TimeAxis::hourOf(CarbonImmutable::parse($a->ends_at), $workDate, $company);

            return [
                'id' => $a->id,
                'uuid' => $a->uuid,
                'positionId' => $a->position_id,
                'personId' => $a->person_id,
                'workDate' => $workDate->toDateString(),
                'startHour' => $from,
                'endHour' => $to,
                'left' => $axis->percent($from),
                'width' => $axis->percent($to) - $axis->percent($from),
                'label' => $this->clock($from).'–'.$this->clock($to),
                'crossesMidnight' => $to > 24,
                // El humano DECIDIÓ colocarlo pese al aviso. La parrilla lo distingue de
                // un turno que nadie ha revisado: no es lo mismo un error que una
                // decisión tomada.
                'forced' => $a->override !== null,
            ];
        })->all();
    }

    private function conceptRows(Collection $concepts, Company $company, TimeAxis $axis): array
    {
        return $concepts->map(function (ConceptEntry $e) use ($company, $axis) {
            $workDate = CarbonImmutable::parse($e->work_date);
            $from = TimeAxis::hourOf(CarbonImmutable::parse($e->starts_at), $workDate, $company);
            $to = TimeAxis::hourOf(CarbonImmutable::parse($e->ends_at), $workDate, $company);

            return [
                'id' => $e->id,
                'personId' => $e->person_id,
                'name' => $e->conceptType->name,
                'computation' => $e->conceptType->computation->value,
                'countsAsWork' => $e->conceptType->computation === Computation::Adds,
                'workDate' => $workDate->toDateString(),
                'startHour' => $from,
                'endHour' => $to,
                'left' => $axis->percent($from),
                'width' => $axis->percent($to) - $axis->percent($from),
                'label' => $this->clock($from).'–'.$this->clock($to),
            ];
        })->all();
    }

    private function absenceRows(Collection $absences): array
    {
        return $absences->map(fn (Absence $a) => [
            'id' => $a->id,
            'personId' => $a->person_id,
            'name' => $a->absenceType->name,
            'startsOn' => CarbonImmutable::parse($a->starts_on)->toDateString(),
            // null = abierta hacia el futuro. Una baja sin alta todavía.
            'endsOn' => $a->ends_on ? CarbonImmutable::parse($a->ends_on)->toDateString() : null,
            'blocks' => $a->absenceType->computation === Computation::Blocks,
        ])->all();
    }

    private function coverage(CoverageReport $report, Company $company, TimeAxis $axis): array
    {
        return [
            'segments' => $report->segments->map(function (CoverageSegment $s) use ($company, $axis) {
                $from = TimeAxis::hourOf($s->startsAt, $s->workDate, $company);
                $to = TimeAxis::hourOf($s->endsAt, $s->workDate, $company);

                return [
                    'positionId' => $s->position->id,
                    'workDate' => $s->workDate->toDateString(),
                    'startHour' => $from,
                    'endHour' => $to,
                    'left' => $axis->percent($from),
                    'width' => $axis->percent($to) - $axis->percent($from),
                    'required' => $s->required,
                    'covered' => $s->covered,
                    'missing' => $s->missing(),
                    'excess' => $s->excess(),
                    'label' => $this->clock($from).'–'.$this->clock($to),
                ];
            })->values()->all(),

            // Errores de CONFIGURACIÓN, no del cuadrante: puestos que nadie puede
            // cubrir, requisitos duplicados, demandas anuladas por precedencia. El
            // problema no está en la parrilla, está en el catálogo.
            'conflicts' => $report->conflicts->map(fn ($v) => $v->toArray())->values()->all(),
        ];
    }

    /**
     * El panel de plantilla. Solo para quien gestiona: lleva contadores de horas.
     */
    private function staff(Calendar $calendar, TimeWindow $window, Company $company): array
    {
        $employments = $calendar->employments()
            ->with(['person', 'profile', 'positions'])
            ->get();

        $shared = $this->sharedElsewhere($employments->pluck('person_id')->all(), $window, $company);

        // El contador de TODA la plantilla en dos consultas, no en dos por persona.
        $minutes = $this->counter->workedMinutesFor($employments->modelKeys(), $window);

        return $employments->map(function (Employment $e) use ($minutes, $shared) {
            $limits = $this->limits->for($e);
            $worked = $minutes[$e->id] ?? 0;

            return [
                'employmentId' => $e->id,
                'personId' => $e->person_id,
                'name' => trim($e->person->first_name.' '.$e->person->last_name),
                'initials' => PersonPalette::initials($e->person->first_name, $e->person->last_name),
                'color' => PersonPalette::for($e->person_id),
                'profile' => $e->profile?->name,
                'positions' => $e->positions->pluck('name')->all(),
                'workedMinutes' => $worked,
                // null = SIN LÍMITE. No es cero, y la interfaz no debe pintarlo como
                // "0 de 0": debe pintar una barra sin tope.
                'limitMinutes' => $limits->maxMinutesWeek,
                'overLimit' => $limits->maxMinutesWeek !== null && $worked > $limits->maxMinutesWeek,
                'hasProfile' => $limits->hasProfile,
                'sharedElsewhere' => in_array($e->person_id, $shared, true),
            ];
        })->values()->all();
    }

    /**
     * Quién trabaja esta semana en OTRA empresa.
     *
     * Una sola consulta para toda la plantilla: preguntarlo persona a persona sería
     * un N+1 de manual. Y devuelve SOLO el hecho (sí/no), nunca dónde: eso ya lo
     * decide el redactor, y aquí ni siquiera se consulta el nombre.
     *
     * @return array<int, int>
     */
    private function sharedElsewhere(array $personIds, TimeWindow $window, Company $company): array
    {
        if ($personIds === []) {
            return [];
        }

        return Assignment::query()
            ->whereIn('person_id', $personIds)
            ->whereBetween('work_date', $window->toDateRange())
            ->where('company_id', '!=', $company->id)
            ->distinct()
            ->pluck('person_id')
            ->all();
    }

    /** 8.5 -> "08:30". 30.0 -> "06:00" (del día siguiente). */
    private function clock(float $hour): string
    {
        $normalised = fmod(fmod($hour, 24) + 24, 24);
        $h = (int) floor($normalised);
        $m = (int) round(($normalised - $h) * 60);

        return sprintf('%02d:%02d', $h, $m);
    }

    private function rangeLabel(TimeWindow $window): string
    {
        $from = $window->from;
        $to = $window->to;

        if ($from->month === $to->month) {
            return $from->day.' – '.$to->day.' '.$this->monthName($to).' '.$to->year;
        }

        return $from->day.' '.$this->monthName($from).' – '.$to->day.' '.$this->monthName($to).' '.$to->year;
    }

    private function weekdayName(CarbonImmutable $date): string
    {
        return ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][$date->dayOfWeekIso - 1];
    }

    private function monthName(CarbonImmutable $date): string
    {
        return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][$date->month - 1];
    }
}
