<?php

namespace Tests\Support;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\Recurrence;
use App\Models\Absence;
use App\Models\AbsenceType;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\ConceptEntry;
use App\Models\ConceptType;
use App\Models\CoverageRequirement;
use App\Models\Employment;
use App\Models\Person;
use App\Models\Position;
use App\Models\User;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Carbon\CarbonImmutable;

/**
 * Monta los 20 negocios y los EJERCITA.
 *
 * Lo importante: los turnos se colocan PASANDO POR EL VALIDADOR REAL, y solo se
 * escriben los que el motor declara LIMPIOS. Esa es la premisa de la prueba de
 * coherencia global: si el motor dijo "limpio" uno a uno, el conjunto entero tiene
 * que seguir limpio al re-validarlo.
 *
 * El generador es DETERMINISTA (semilla fija): un fallo se puede reproducir.
 */
class StressWorld
{
    public User $owner;

    /** @var array<string, Company> */
    public array $companies = [];

    /** @var array<string, array<int, Employment>> */
    public array $employments = [];

    /** @var array<string, Calendar> */
    public array $calendars = [];

    /** @var array<string, array<string, Position>> */
    public array $positions = [];

    /** @var array<string, array{concept: array, absence: array}> */
    public array $catalogs = [];

    /** @var array<int, Person> Personas con contrato en varias empresas. */
    public array $sharedPeople = [];

    public int $placed = 0;

    public int $rejected = 0;

    private int $seed = 1;

    public function __construct(private AssignmentValidator $validator) {}

    /** Números pseudoaleatorios deterministas: un fallo se puede reproducir. */
    private function rand(int $max): int
    {
        $this->seed = ($this->seed * 1103515245 + 12345) & 0x7FFFFFFF;

        return $max > 0 ? $this->seed % $max : 0;
    }

    public function build(CarbonImmutable $from, CarbonImmutable $to): self
    {
        $this->owner = User::create([
            'name' => 'Antonio',
            'email' => 'empresario@turnia.test',
            'password' => 'secret',
        ]);

        foreach (BusinessCatalog::all() as $blueprint) {
            $this->buildBusiness($blueprint);
        }

        $this->sharePeopleAcrossBusinesses();

        foreach (BusinessCatalog::all() as $blueprint) {
            $this->fillCalendar($blueprint, $from, $to);
        }

        return $this;
    }

    private function buildBusiness(BusinessBlueprint $bp): void
    {
        $company = $this->owner->companies()->create(array_merge([
            'name' => $bp->name,
            'timezone' => 'Europe/Madrid',
        ], $bp->companyAttributes));

        $this->companies[$bp->key] = $company;

        foreach ($bp->holidays as $date) {
            $company->holidays()->create(['date' => $date, 'name' => 'Festivo']);
        }

        foreach ($bp->positions as $name) {
            $this->positions[$bp->key][$name] = $company->positions()->create(['name' => $name]);
        }

        $profiles = [];
        foreach ($bp->profiles as $spec) {
            $profiles[] = $company->profiles()->create(array_merge(['name' => $spec['name']], $spec['limits']));
        }

        $this->catalogs[$bp->key] = [
            'medica' => $company->conceptTypes()->create(['name' => 'Hora médica', 'computation' => Computation::Adds]),
            'extra' => $company->conceptTypes()->create(['name' => 'Hora extra', 'computation' => Computation::SeparateCounter]),
            'sin_sueldo' => $company->conceptTypes()->create(['name' => 'Permiso sin sueldo', 'computation' => Computation::ReducesRequired]),
            'baja' => $company->absenceTypes()->create([
                'name' => 'Baja laboral', 'computation' => Computation::Blocks,
                'scope' => AbsenceScope::Person, 'consumes_leave_quota' => false,
            ]),
            'vacaciones' => $company->absenceTypes()->create([
                'name' => 'Vacaciones', 'computation' => Computation::Blocks,
                'scope' => AbsenceScope::Employment, 'consumes_leave_quota' => true,
            ]),
        ];

        $calendar = $company->calendars()->create(['name' => 'Cuadrante']);
        $this->calendars[$bp->key] = $calendar;

        foreach ($bp->coverage as $spec) {
            $position = $this->positions[$bp->key][$spec['position']];

            foreach ($spec['days'] as $day) {
                CoverageRequirement::create([
                    'calendar_id' => $calendar->id,
                    'position_id' => $position->id,
                    'effective_from' => '2020-01-01',
                    'recurrence' => Recurrence::Weekly,
                    'day_of_week' => $day,
                    'starts_at' => $spec['from'],
                    'ends_at' => $spec['to'],
                    'required_count' => $spec['count'],
                ]);
            }
        }

        // Empleados: personas nuevas, con su contrato en esta empresa.
        for ($i = 1; $i <= $bp->employees; $i++) {
            $person = $this->owner->people()->create([
                'first_name' => 'Emp'.$i,
                'last_name' => $bp->key,
            ]);

            $profile = $profiles[$i % count($profiles)];

            $overrides = [];
            if ($bp->overrideRatio > 0 && ($i / max(1, $bp->employees)) <= $bp->overrideRatio) {
                // Nadie usa el perfil puro: cada uno con su excepción individual.
                $overrides = [
                    'max_minutes_week_override' => 1200 + ($i % 5) * 240,
                    'min_rest_minutes_between_shifts_override' => 660,
                    'annual_leave_days_override' => 20 + ($i % 4),
                ];
            }

            $employment = $company->employments()->create(array_merge([
                'person_id' => $person->id,
                'profile_id' => $profile->id,
                'starts_on' => '2024-01-01',
            ], $overrides));

            // Cualificación: cada empleado puede cubrir un subconjunto de puestos.
            $all = array_values($this->positions[$bp->key]);
            $employment->positions()->attach(
                collect($all)->filter(fn ($p, $idx) => ($idx + $i) % 2 === 0 || count($all) === 1)
                    ->pluck('id')->all() ?: [$all[0]->id]
            );

            $this->employments[$bp->key][] = $employment;
        }
    }

    /**
     * CRUZA GENTE ENTRE NEGOCIOS.
     *
     * Aquí es donde el motor más fácil se rompe: el descanso y el solape se validan a
     * nivel de PERSONA, cruzando empresas.
     */
    private function sharePeopleAcrossBusinesses(): void
    {
        $pairs = [
            ['tapas', 'restaurante'],      // camarera en dos locales
            ['grupo_a', 'tapas'],          // grupo con personal compartido
            ['discoteca', 'moda'],         // fin de semana en la sala, semana en la tienda
            ['panaderia', 'super'],        // madrugada en el obrador, tarde en el súper
            ['seguridad', 'hotel'],        // vigilante que también hace recepción
            ['peluqueria', 'libra_lunes'], // dos negocios pequeños
        ];

        foreach ($pairs as [$a, $b]) {
            // Se coge una persona que YA trabaja en A y se le da un contrato en B.
            $source = $this->employments[$a][0];
            $person = $source->person;

            $companyB = $this->companies[$b];
            $profileB = $companyB->profiles()->first();

            $employmentB = $companyB->employments()->create([
                'person_id' => $person->id,
                'profile_id' => $profileB->id,
                'starts_on' => '2024-01-01',
            ]);

            $employmentB->positions()->attach($companyB->positions()->pluck('id')->all());

            $this->employments[$b][] = $employmentB;
            $this->sharedPeople[$person->id] = $person;
        }

        // Y una persona con TRES contratos: el caso que más cruza.
        $person = $this->employments['grupo_a'][1]->person;

        foreach (['restaurante', 'moda'] as $key) {
            $company = $this->companies[$key];
            $employment = $company->employments()->create([
                'person_id' => $person->id,
                'profile_id' => $company->profiles()->first()->id,
                'starts_on' => '2024-01-01',
            ]);
            $employment->positions()->attach($company->positions()->pluck('id')->all());
            $this->employments[$key][] = $employment;
        }

        $this->sharedPeople[$person->id] = $person;
    }

    /**
     * Rellena el cuadrante: intenta cubrir cada requisito con gente elegible, y SOLO
     * escribe lo que el motor declara limpio.
     */
    private function fillCalendar(BusinessBlueprint $bp, CarbonImmutable $from, CarbonImmutable $to): void
    {
        $calendar = $this->calendars[$bp->key];
        $requirements = CoverageRequirement::where('calendar_id', $calendar->id)->with('position')->get();
        $employments = $this->employments[$bp->key];
        $company = $this->companies[$bp->key];

        $rotation = 0;

        for ($date = $from; $date->lte($to); $date = $date->addDay()) {
            if (in_array($date->month, $bp->closedMonths, true)) {
                continue; // Negocio estacional: cerrado.
            }

            foreach ($requirements as $requirement) {
                if ($requirement->day_of_week !== $date->dayOfWeekIso) {
                    continue;
                }

                for ($slot = 0; $slot < $requirement->required_count; $slot++) {
                    $candidates = collect($employments)
                        ->filter(fn (Employment $e) => $e->positions->contains('id', $requirement->position_id))
                        ->values();

                    if ($candidates->isEmpty()) {
                        continue;
                    }

                    // Se prueban varios candidatos: el encargado no se rinde con el primero.
                    for ($try = 0; $try < min(6, $candidates->count()); $try++) {
                        $employment = $candidates[($rotation + $try) % $candidates->count()];

                        $endsNextDay = $requirement->ends_at <= $requirement->starts_at;

                        $draft = new AssignmentDraft(
                            employment: $employment,
                            position: $requirement->position,
                            workDate: $date,
                            startsAt: $company->toUtc($date->toDateString(), (string) $requirement->starts_at),
                            endsAt: $company->toUtc(
                                $endsNextDay ? $date->addDay()->toDateString() : $date->toDateString(),
                                (string) $requirement->ends_at,
                            ),
                        );

                        if (! $this->validator->validate($draft)->isClean()) {
                            $this->rejected++;

                            continue;
                        }

                        Assignment::create([
                            'calendar_id' => $calendar->id,
                            'employment_id' => $employment->id,
                            'position_id' => $requirement->position_id,
                            'work_date' => $date->toDateString(),
                            'starts_at' => $draft->startsAt,
                            'ends_at' => $draft->endsAt,
                        ]);

                        $this->placed++;
                        $rotation++;

                        break;
                    }
                }
            }
        }
    }

    /** Mete bajas, vacaciones, horas médicas y horas extra de forma realista. */
    public function exercise(CarbonImmutable $from, CarbonImmutable $to): void
    {
        foreach ($this->employments as $key => $employments) {
            $catalog = $this->catalogs[$key];

            foreach ($employments as $i => $employment) {
                // Una hora médica de cada 4 empleados.
                if ($i % 4 === 0) {
                    $this->tryConcept($employment, $catalog['medica'], $from->addDays(3 + $i), '10:00', '12:00');
                }

                // Una hora extra de cada 5.
                if ($i % 5 === 0) {
                    $this->tryConcept($employment, $catalog['extra'], $from->addDays(6 + $i), '22:00', '23:30');
                }

                // Vacaciones de una semana para uno de cada 6.
                if ($i % 6 === 0) {
                    $this->tryAbsence($employment->person, $catalog['vacaciones'], $employment,
                        $from->addDays(10), $from->addDays(16));
                }
            }

            // Una baja abierta por empresa, en el primer empleado que no esté ya ausente.
            $victim = $employments[min(2, count($employments) - 1)];

            $this->tryAbsence($victim->person, $catalog['baja'], null, $from->addDays(20), null);
        }
    }

    private function tryConcept(Employment $employment, ConceptType $type, CarbonImmutable $date, string $de, string $a): void
    {
        $company = $employment->company;

        try {
            ConceptEntry::create([
                'employment_id' => $employment->id,
                'concept_type_id' => $type->id,
                'work_date' => $date->toDateString(),
                'starts_at' => $company->toUtc($date->toDateString(), $de),
                'ends_at' => $company->toUtc($date->toDateString(), $a),
            ]);
        } catch (\Throwable) {
            // Un choque puntual no invalida el escenario: el motor lo detectará.
        }
    }

    private function tryAbsence(Person $person, AbsenceType $type, ?Employment $employment, CarbonImmutable $from, ?CarbonImmutable $to): void
    {
        Absence::create([
            'person_id' => $person->id,
            'employment_id' => $employment?->id,
            'absence_type_id' => $type->id,
            'starts_on' => $from->toDateString(),
            'ends_on' => $to?->toDateString(),
        ]);
    }
}
