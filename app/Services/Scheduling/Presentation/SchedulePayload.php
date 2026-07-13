<?php

namespace App\Services\Scheduling\Presentation;

use App\Enums\Computation;
use App\Enums\RuleCode;
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
use App\Services\Scheduling\WindowResolver;
use App\Services\Scheduling\WorkdayCalendar;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

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
 *
 * ⚠️ Y LA COBERTURA VIAJA CON ÉL (coverage()), EN LA MISMA PETICIÓN DIFERIDA.
 *
 * No es una optimización: es que la cobertura DEPENDE del informe. Un turno imposible no
 * cubre el puesto, y saber cuáles son imposibles es exactamente el trabajo que cuesta 700 ms.
 *
 * Y por eso se calcula en el SERVIDOR y no en la vista: al empleado se le mandan las
 * violaciones de SUS turnos y no las de sus compañeros, así que un navegador que dedujera el
 * déficit a partir de lo que ha recibido pintaría un hueco distinto según quién mirase. El
 * hueco de un puesto es un hecho del cuadrante, no una opinión del espectador.
 */
class SchedulePayload
{
    /**
     * El informe de la ventana, calculado UNA vez.
     *
     * violations() y coverage() son dos props diferidas del MISMO grupo: llegan en la misma
     * petición, y las dos necesitan el informe. Sin este memo se validaría dos veces la
     * misma semana, y son 700 ms cada pasada.
     *
     * @var array{key: string, rows: Collection<int, ReportedViolation>}|null
     */
    private ?array $memo = null;

    public function __construct(
        private HourCounter $counter,
        private LimitResolver $limits,
        private WorkdayCalendar $workdays,
        private CoverageCalculator $coverageCalculator,
        private ViolationReport $report,
        private WindowResolver $windows,
    ) {}

    /**
     * @param  string  $granularity  'week' | 'day'. Solo cambia por dónde navegan las
     *                               flechas: el motor recibe una ventana y no sabe de
     *                               qué tamaño es.
     */
    public function build(Calendar $calendar, TimeWindow $window, ScheduleScope $scope, string $granularity = 'week'): array
    {
        $company = $calendar->company;

        $assignments = $this->assignments($calendar, $window);
        $concepts = $this->conceptEntries($company, $window, $scope);
        $absences = $this->absences($company, $window, $scope);

        /*
         * El eje SÍ se calcula en la carga, y para eso hace falta la cobertura: un requisito
         * de barra a las 05:00 tiene que ensanchar el eje aunque no haya nadie colocado.
         *
         * Este cálculo es barato (dos consultas: requisitos y turnos) y NO lleva exclusiones,
         * y no las necesita: excluir un turno del RECUENTO no mueve ningún borde —el turno
         * sigue partiendo el día— así que el eje sale idéntico al de la petición diferida.
         * Lo caro es decidir QUÉ turno es imposible, y eso no se hace aquí.
         */
        $axis = $this->axisFor(
            $company,
            $assignments,
            $concepts,
            $this->coverageCalculator->forCalendar($calendar, $window)->segments,
        );

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
            'window' => $this->window($company, $window, $granularity),
            'granularity' => $granularity,
            'axis' => $axis->toArray(),
            'positions' => $this->positions($calendar),
            'people' => $this->people($assignments, $concepts, $absences),
            'assignments' => $this->assignmentRows($assignments, $company, $axis),
            'conceptEntries' => $this->conceptRows($concepts, $company, $axis),
            'absences' => $this->absenceRows($absences, $company),
            /*
             * ⚠️ EL CONTADOR DE LA PLANTILLA VA SIEMPRE SOBRE LA SEMANA, mire uno el zoom
             * que mire, y no es un descuido de haber reutilizado la ventana.
             *
             * El tope del perfil es SEMANAL. Si en la vista Día contáramos el día contra
             * el tope de la semana, Sara saldría como "7 de 40 h" —holgadísima— cuando en
             * realidad lleva 42 de 40 y está incumpliendo. Sería un aviso falso al revés:
             * un silencio, y en el sitio donde el encargado decide a quién puede cargarle
             * otro turno.
             *
             * La unidad del numerador tiene que ser la misma que la del denominador.
             */
            'staff' => $scope->seesStaffPanel()
                ? $this->staff($calendar, $this->windows->week($window->from), $company)
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

        $rows = $this->reportFor($company, $window)
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
     * LA COBERTURA REAL. También diferida, y en el MISMO grupo que las violaciones.
     *
     * Descuenta los turnos que el motor declara IMPOSIBLES: si Tomás está en Caja de 10 a 18
     * y de 14 a 20 a la vez, a las 15:00 no hay nadie en Caja, por mucho que haya dos filas
     * en la tabla. Contarlas era pintar de verde un puesto descubierto.
     *
     * ⚠️ NO SE RECORTA POR ESPECTADOR, y es deliberado: el déficit de un puesto es el mismo
     * para el dueño, para el encargado y para el que friega. No lleva ningún dato personal —
     * son números— y hacerlo depender de quién mira sería fabricar dos verdades.
     */
    public function coverage(Calendar $calendar, TimeWindow $window, ScheduleScope $scope): array
    {
        $imposibles = $this->reportFor($calendar->company, $window)
            ->filter(fn (ReportedViolation $row) => $row->kind === 'assignment')
            ->filter(fn (ReportedViolation $row) => $row->result->impossibles()->isNotEmpty())
            ->map(fn (ReportedViolation $row) => $row->subject->getKey())
            ->all();

        $report = $this->coverageCalculator->forCalendar($calendar, $window, $imposibles);

        return $this->coverageRows($report, $calendar->company, $this->axisOf($calendar, $window, $scope))
            + ['closed' => $this->closedDays($report, $calendar->company, $window)];
    }

    /**
     * Los días en que el negocio de verdad CIERRA. Que no es lo mismo que "no laborable".
     *
     * ⚠️ UN BAR ABRE EN FESTIVO CON TODA NORMALIDAD.
     *
     * Teñir la columna por lo que diga el calendario laboral sería sugerir "aquí no se trabaja"
     * un día en el que se trabaja — y en hostelería el festivo es justo el pico de carga. La
     * etiqueta del calendario no es el dato accionable.
     *
     * El dato accionable es la conjunción: el día NO es laborable Y ADEMÁS no se pide a nadie
     * en ningún puesto. Entonces sí: ese día el negocio está cerrado, y una celda vacía ahí no
     * es un cuadrante sin hacer.
     *
     * Y por eso vive con la cobertura y no con la ventana: depende de la DEMANDA.
     *
     * @return array<int, string>
     */
    private function closedDays(CoverageReport $report, Company $company, TimeWindow $window): array
    {
        $conDemanda = $report->segments
            ->filter(fn (CoverageSegment $s) => $s->required > 0)
            ->map(fn (CoverageSegment $s) => $s->workDate->toDateString())
            ->unique()
            ->all();

        $closed = [];

        for ($date = $window->from; $date->lte($window->to); $date = $date->addDay()) {
            $key = $date->toDateString();

            if (! $this->workdays->isWorkingDay($company, $date) && ! in_array($key, $conDemanda, true)) {
                $closed[] = $key;
            }
        }

        return $closed;
    }

    /**
     * El informe de la ventana, calculado una sola vez por petición.
     *
     * @return Collection<int, ReportedViolation>
     */
    private function reportFor(Company $company, TimeWindow $window): Collection
    {
        $key = $company->id.'|'.$window->from->toDateString().'|'.$window->to->toDateString();

        if ($this->memo === null || $this->memo['key'] !== $key) {
            $this->memo = ['key' => $key, 'rows' => $this->report->forCompany($company, $window)];
        }

        return $this->memo['rows'];
    }

    /**
     * El MISMO eje que se mandó en la carga.
     *
     * Los segmentos de cobertura se posicionan en porcentajes, y un porcentaje solo
     * significa algo contra un eje. Si esta petición usara un eje distinto del que ya está
     * pintado, las barras de cobertura caerían desplazadas respecto a los turnos: cada cosa
     * en su hora, y las dos mintiendo.
     *
     * ⚠️ Y POR ESO LLEVA EL SCOPE, aunque la cobertura no se recorte por espectador: el eje
     * de la carga se ensancha con los conceptos que ESE espectador ve, y el empleado no ve
     * los de sus compañeros. Mismo espectador, mismo input, mismo eje.
     */
    private function axisOf(Calendar $calendar, TimeWindow $window, ScheduleScope $scope): TimeAxis
    {
        $company = $calendar->company;

        return $this->axisFor(
            $company,
            $this->assignments($calendar, $window),
            $this->conceptEntries($company, $window, $scope),
            $this->coverageCalculator->forCalendar($calendar, $window)->segments,
        );
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
            // employment.positions: para saber en qué fila pintar un concepto de alguien que
            // ese día NO tiene turno. Ponerlo en el primer puesto de la lista sería afirmar
            // que cubre la barra cuando quizá es de cocina.
            ->with(['conceptType', 'person', 'employment.positions'])
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

    private function window(Company $company, TimeWindow $window, string $granularity): array
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

        $step = $granularity === 'day' ? 1 : 7;

        return [
            'from' => $window->from->toDateString(),
            'to' => $window->to->toDateString(),
            'isoWeek' => $window->from->isoWeek(),
            'label' => $granularity === 'day'
                ? $this->weekdayName($window->from).' '.$window->from->day.' '.$this->monthName($window->from).' '.$window->from->year
                : $this->rangeLabel($window),
            'previous' => $window->from->subDays($step)->toDateString(),
            'next' => $window->from->addDays($step)->toDateString(),
            // Para poder volver a la semana que contiene este día, y al revés.
            'weekOf' => $window->from->startOfWeek(CarbonImmutable::MONDAY)->toDateString(),
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
                'color' => PersonPalette::for($p->first_name.' '.$p->last_name),
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
                // Los puestos que esa persona PUEDE cubrir. Un concepto de alguien que ese
                // día no tiene turno se pinta en uno de estos, nunca en uno cualquiera.
                'eligiblePositionIds' => $e->employment->positions->pluck('id')->all(),
                'name' => $e->conceptType->name,
                'computation' => $e->conceptType->computation->value,
                /*
                 * ⚠️ NINGÚN CONCEPTO CUBRE EL PUESTO, PERO NO TODOS CUENTAN IGUAL.
                 *
                 * Los cuatro cómputos pintaban el mismo recuadro discontinuo: "hora extra" y
                 * "hora médica" —opuestos para el contador— eran el mismo píxel. Y este campo
                 * ya viajaba, sin que nadie lo mirase.
                 *
                 * La pregunta que el encargado se hace de verdad es "¿le puedo dar otro
                 * turno?", y para eso lo que importa es si ese rato SUMA TIEMPO a algún
                 * contador: Adds al principal, SeparateCounter al suyo propio (las horas
                 * extra, que tienen su propio tope). ReducesRequired y Blocks no suman tiempo:
                 * ocupan a la persona y no computan.
                 */
                'computa' => in_array(
                    $e->conceptType->computation,
                    [Computation::Adds, Computation::SeparateCounter],
                    true,
                ),
                'workDate' => $workDate->toDateString(),
                'startHour' => $from,
                'endHour' => $to,
                'left' => $axis->percent($from),
                'width' => $axis->percent($to) - $axis->percent($from),
                'label' => $this->clock($from).'–'.$this->clock($to),
                /*
                 * ⚠️ ESTE CAMPO NO ESTABA, Y LOS TURNOS SÍ LO TENÍAN.
                 *
                 * Una hora extra de 22:00 a 06:00 CRUZA MEDIANOCHE igual que un turno, y la
                 * parrilla no lo decía: ni el filo de "sigue mañana", ni la nota, ni el ☾. El
                 * bloque más difícil de leer de un cuadrante —el que se sale del día— era
                 * justo el que se pintaba mudo cuando era un concepto.
                 *
                 * Lo destapó el hueco del producto cartesiano: el caso "concepto nocturno" no
                 * se alcanzaba NUNCA por mucho que lo sembrara, y la razón era que el dato no
                 * salía del servidor. Un caso que no se puede alcanzar es un caso que no se
                 * puede probar.
                 */
                'crossesMidnight' => $to > 24,
            ];
        })->all();
    }

    private function absenceRows(Collection $absences, Company $company): array
    {
        $eligible = $this->eligiblePositions($absences->pluck('person_id')->unique()->all(), $company);

        return $absences->map(fn (Absence $a) => [
            'id' => $a->id,
            'personId' => $a->person_id,
            'name' => $a->absenceType->name,
            'startsOn' => CarbonImmutable::parse($a->starts_on)->toDateString(),
            // null = abierta hacia el futuro. Una baja sin alta todavía, y la parrilla lo dice:
            // se pintaba IGUAL que una baja que simplemente sigue la semana que viene, y son
            // dos hechos distintos.
            'endsOn' => $a->ends_on ? CarbonImmutable::parse($a->ends_on)->toDateString() : null,
            // Bloquea la disponibilidad, o solo la registra. La banda lo ignoraba: unas
            // vacaciones y una formación se pintaban idénticas.
            'blocks' => $a->absenceType->computation === Computation::Blocks,
            'eligiblePositionIds' => $eligible[$a->person_id] ?? [],
        ])->all();
    }

    /**
     * Los puestos que cada persona PUEDE cubrir en esta empresa.
     *
     * ⚠️ LA BANDA DE UNA BAJA NO PUEDE CAER EN "EL PRIMER PUESTO DE LA LISTA".
     *
     * La vista la colocaba en el puesto de menor id donde esa persona tuviera turnos, y si no
     * tenía ninguno —que es JUSTO el caso de una baja larga— caía en positions[0]. La baja de
     * Nuria, que es de cocina, salía pintada en la fila de BARRA: afirmando un agujero en un
     * puesto que ella no cubre. Es exactamente el mismo bug que ya estaba arreglado —y
     * documentado— para los conceptos huérfanos, cuarenta líneas más abajo.
     *
     * Va a TODAS las filas que esa persona puede cubrir, que es donde de verdad deja el hueco.
     *
     * @param  array<int, int>  $personIds
     * @return array<int, array<int, int>>
     */
    private function eligiblePositions(array $personIds, Company $company): array
    {
        if ($personIds === []) {
            return [];
        }

        return DB::table('employment_position')
            ->join('employments', 'employments.id', '=', 'employment_position.employment_id')
            ->where('employments.company_id', $company->id)
            ->whereNull('employments.deleted_at')
            ->whereIn('employments.person_id', $personIds)
            ->select('employments.person_id', 'employment_position.position_id')
            ->get()
            ->groupBy('person_id')
            ->map(fn (Collection $rows) => $rows->pluck('position_id')->unique()->values()->all())
            ->all();
    }

    private function coverageRows(CoverageReport $report, Company $company, TimeAxis $axis): array
    {
        // Los puestos que NADIE de la plantilla puede cubrir. Su hueco NO es rojo: un
        // hueco rojo dice "ponle a alguien", y aquí no hay a quién poner. Pintarlo igual
        // que un hueco normal deshace el aviso que el motor se molestó en dar.
        $uncoverable = $report->conflicts
            ->filter(fn ($v) => $v->code === RuleCode::UncoverablePosition)
            ->map(fn ($v) => $v->context['position_id'] ?? null)
            ->filter()
            ->all();

        $segments = $report->segments->map(function (CoverageSegment $s) use ($company, $axis, $uncoverable) {
            $from = TimeAxis::hourOf($s->startsAt, $s->workDate, $company);
            $to = TimeAxis::hourOf($s->endsAt, $s->workDate, $company);

            $incubrible = $s->isGap() && in_array($s->position->id, $uncoverable, true);

            return [
                'positionId' => $s->position->id,
                'workDate' => $s->workDate->toDateString(),
                'startHour' => $from,
                'endHour' => $to,
                'left' => $axis->percent($from),
                'width' => $axis->percent($to) - $axis->percent($from),
                'required' => $s->required,
                'covered' => $s->covered,
                /*
                 * ⚠️ EL DÉFICIT VA SIEMPRE, TAMBIÉN CUANDO NADIE PUEDE CUBRIRLO.
                 *
                 * "sin candidato" y "faltan 2" son DOS informaciones distintas, y la primera
                 * se estaba comiendo a la segunda: el tramo del sumiller solo decía "sin…"
                 * —truncado, ilegible— y el número no aparecía en ninguna parte. Que no haya
                 * a quién poner no hace que falte menos gente.
                 *
                 * El "sin candidato" ya se dice con el rayado gris y con la etiqueta de la
                 * celda. El hueco, con su número, como cualquier otro.
                 */
                'missing' => $s->missing(),
                'excess' => $s->excess(),
                // covered | missing | excess | unrequested. Lo decide el motor, no la vista: dos
                // respuestas a la misma pregunta acaban divergiendo.
                //
                // `unrequested` es el cuarto, y es de esta tanda: donde NO SE PIDE A NADIE no
                // sobra nadie. Ver CoverageSegment::isUnrequested().
                'state' => $s->state(),
                // Y esto es un hecho del CATÁLOGO, no del tramo: no sustituye al estado,
                // lo acompaña. Un tramo puede estar cubierto en un puesto incubrible.
                'uncoverable' => $incubrible,
                'label' => $this->clock($from).'–'.$this->clock($to),
            ];
        })->values()->all();

        return [
            'segments' => $segments,

            // Errores de CONFIGURACIÓN, no del cuadrante: puestos que nadie puede
            // cubrir, requisitos duplicados, demandas anuladas por precedencia. El
            // problema no está en la parrilla, está en el catálogo.
            'conflicts' => $report->conflicts->map(fn ($v) => $v->toArray())->values()->all(),

            /*
             * ⚠️ LOS HUECOS CUENTAN COMO INCIDENCIA, Y ESTE TOTAL EXISTE POR ESO.
             *
             * El indicador de la cabecera contaba solo turnos que incumplen. En una semana
             * VACÍA no incumple nadie —no hay a quién— así que decía "Sin incidencias" en
             * verde sobre un cuadrante sin un solo turno colocado: el peor cuadrante posible,
             * anunciado como el mejor. Un cuadrante sin problemas y un cuadrante sin nada
             * daban el mismo número.
             */
            'totals' => [
                'gaps' => $report->gaps()->count(),
                'excess' => $report->excesses()->count(),
            ],
        ];
    }

    /**
     * El panel de plantilla. Solo para quien gestiona: lleva contadores de horas.
     *
     * ⚠️ ES DONDE EL ENCARGADO ELIGE A QUIÉN COLOCAR, y por eso lleva BANDERAS.
     *
     * Sin ellas elige a ciegas: no sabe que esa persona está de baja, ni que ya está
     * comprometida en otro bar ese día, ni que arrastra una jornada partida. Un panel que
     * solo dice el nombre y las horas es un panel que calla justo en el momento de decidir.
     */
    private function staff(Calendar $calendar, TimeWindow $window, Company $company): array
    {
        $employments = $calendar->employments()
            ->with(['person', 'profile', 'positions'])
            ->get();

        $shared = $this->sharedElsewhere($employments->pluck('person_id')->all(), $window, $company);

        // El contador de TODA la plantilla en dos consultas, no en dos por persona.
        $minutes = $this->counter->workedMinutesFor($employments->modelKeys(), $window);

        // Los turnos de LA SEMANA, no los del zoom que se esté mirando: las banderas
        // hablan de la semana, igual que el contador.
        $porPersona = Assignment::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->get()
            ->groupBy('person_id');

        $bajas = Absence::query()
            ->where('company_id', $company->id)
            ->where('starts_on', '<=', $window->to->toDateString())
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $window->from->toDateString()))
            ->with('absenceType')
            ->get()
            ->keyBy('person_id');

        return $employments->map(function (Employment $e) use ($minutes, $shared, $porPersona, $bajas, $company) {
            $limits = $this->limits->for($e);
            $worked = $minutes[$e->id] ?? 0;
            $suyas = $porPersona->get($e->person_id, new Collection);

            return [
                'employmentId' => $e->id,
                'personId' => $e->person_id,
                'name' => trim($e->person->first_name.' '.$e->person->last_name),
                'initials' => PersonPalette::initials($e->person->first_name, $e->person->last_name),
                'color' => PersonPalette::for($e->person->first_name.' '.$e->person->last_name),
                'profile' => $e->profile?->name,
                'positions' => $e->positions->pluck('name')->all(),
                'workedMinutes' => $worked,
                // null = SIN LÍMITE. No es cero, y la interfaz no debe pintarlo como
                // "0 de 0": debe pintar una barra sin tope.
                'limitMinutes' => $limits->maxMinutesWeek,
                'overLimit' => $limits->maxMinutesWeek !== null && $worked > $limits->maxMinutesWeek,
                'hasProfile' => $limits->hasProfile,
                'flags' => $this->flagsFor($e, $suyas, $bajas->get($e->person_id), in_array($e->person_id, $shared, true), $company),
            ];
        })->values()->all();
    }

    /**
     * Las banderas de una persona en esta ventana.
     *
     * Todas son ESTRUCTURALES: se ven en los datos, sin re-validar nada. Las que dependen
     * de las reglas (un descanso corto, un tope pasado) las añade la vista cuando llega el
     * informe diferido — porque hasta entonces NO SE SABEN, y afirmarlas antes sería
     * inventárselas.
     *
     * @return array<int, array{kind: string, text: string}>
     */
    private function flagsFor(Employment $e, Collection $suyas, ?Absence $baja, bool $shared, Company $company): array
    {
        $flags = [];

        if ($baja !== null) {
            $desde = CarbonImmutable::parse($baja->starts_on);
            $hasta = $baja->ends_on ? CarbonImmutable::parse($baja->ends_on) : null;

            $flags[] = [
                'kind' => 'neutral',
                'text' => sprintf(
                    '%s · %s',
                    $baja->absenceType->name,
                    $hasta ? $desde->day.'–'.$hasta->day.' '.$this->monthName($hasta) : 'desde el '.$desde->day.' '.$this->monthName($desde),
                ),
            ];
        }

        if ($shared) {
            // Ámbar: es un AVISO. Y sin decir dónde, que eso lo decide el redactor.
            $flags[] = ['kind' => 'notice', 'text' => 'Esta semana también trabaja en otra empresa'];
        }

        if ($suyas->contains(fn (Assignment $a) => TimeAxis::hourOf(CarbonImmutable::parse($a->ends_at), CarbonImmutable::parse($a->work_date), $company) > 24)) {
            $flags[] = ['kind' => 'neutral', 'text' => 'Turno nocturno esta semana'];
        }

        // Jornada partida: dos turnos el mismo día CON AIRE entre ellos. Si se pisan no es
        // una partida: es un solape, y llamarlo partida sería ponerle bandera de normalidad.
        $partida = $suyas
            ->groupBy(fn (Assignment $a) => CarbonImmutable::parse($a->work_date)->toDateString())
            ->contains(function (Collection $delDia) {
                $orden = $delDia->sortBy('starts_at')->values();

                for ($i = 1; $i < $orden->count(); $i++) {
                    if ($orden[$i]->starts_at->gt($orden[$i - 1]->ends_at)) {
                        return true;
                    }
                }

                return false;
            });

        if ($partida) {
            $flags[] = ['kind' => 'neutral', 'text' => 'Jornada partida esta semana'];
        }

        if (! $this->limits->for($e)->hasProfile) {
            $flags[] = ['kind' => 'notice', 'text' => 'Contrato sin condiciones definidas'];
        }

        return $flags;
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
