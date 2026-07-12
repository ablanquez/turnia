<?php

namespace Database\Seeders;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\Recurrence;
use App\Enums\WorkdayType;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\Employment;
use App\Models\Person;
use App\Models\Position;
use App\Models\Profile;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * EL BAR DE LA DEMO.
 *
 * No es un cuadrante bonito: es un cuadrante ROTO A PROPÓSITO. Un cuadrante perfecto
 * no demuestra nada — cualquier hoja de cálculo pinta un cuadrante perfecto. Lo que
 * demuestra que hay un motor debajo es que la parrilla SEÑALE lo que está mal, y
 * cada caso difícil de aquí existe para que se vea uno de los avisos:
 *
 *   · jornada partida        → dos barras con un agujero real en medio
 *   · turno nocturno         → una barra que cruza el borde del día
 *   · doble empresa          → un aviso, sin decir dónde (el dato ajeno no se filtra)
 *   · pasarse de horas       → un incumplimiento forzado, con su constancia
 *   · solaparse consigo mismo → un IMPOSIBLE
 *   · una baja               → turnos huérfanos que nadie ha recolocado
 *   · un puesto sin candidato → el problema está en el catálogo, no en la parrilla
 *   · huecos por segmentos   → "de 12 a 14 faltan 3; de 14 a 16 faltan 2"
 */
class DemoSeeder extends Seeder
{
    private CarbonImmutable $monday;

    public function run(): void
    {
        // La semana en curso: la demo siempre enseña algo al abrirla.
        $this->monday = CarbonImmutable::today()->startOfWeek(CarbonImmutable::MONDAY);

        $owner = $this->owner();
        $optim = $this->optim($owner);
        $central = $this->central($owner);

        $this->wire($owner, $optim, $central);
    }

    private function owner(): User
    {
        return User::query()->create([
            'name' => 'Antonio Blanquez',
            'email' => 'demo@turnia.test',
            'password' => Hash::make('turnia'),
        ]);
    }

    private function optim(User $owner): Company
    {
        return $owner->companies()->create([
            'name' => "L'Òptim",
            'timezone' => 'Europe/Madrid',
            'computation_year_start_month' => 1,
            'computation_year_start_day' => 1,
            // Un bar no libra sábado y domingo: libra el lunes. El motor no lo sabía:
            // se lo dice la empresa.
            'non_working_weekdays' => [1],
        ]);
    }

    /** La otra empresa del mismo dueño. Existe para que exista el aviso de doble empresa. */
    private function central(User $owner): Company
    {
        return $owner->companies()->create([
            'name' => 'Bar Central',
            'timezone' => 'Europe/Madrid',
            'computation_year_start_month' => 1,
            'computation_year_start_day' => 1,
            'non_working_weekdays' => [1],
        ]);
    }

    private function wire(User $owner, Company $optim, Company $central): void
    {
        $positions = $this->positions($optim);
        $profiles = $this->profiles($optim);
        $catalogue = $this->catalogue($optim);

        $calendar = $optim->calendars()->create([
            'name' => 'Sala y barra',
            'starts_on' => $this->monday->subMonths(6)->toDateString(),
            'ends_on' => null,
            'is_active' => true,
        ]);

        $people = $this->people($owner);
        $employments = $this->employments($optim, $people, $profiles, $positions, $calendar);

        $this->logins($owner, $optim, $people['ana']);
        $this->demand($calendar, $positions);
        $this->shifts($calendar, $employments, $positions, $owner);
        $this->concepts($employments, $catalogue);
        $this->absences($employments, $people, $catalogue);
        $this->elsewhere($central, $people['marco'], $profiles);
    }

    /** @return array<string, Position> */
    private function positions(Company $company): array
    {
        $names = [
            'barra' => 'Barra',
            'cocina' => 'Cocina',
            'sala' => 'Sala',
            'caja' => 'Caja',
            // ⚠️ NADIE va a estar cualificado para esto. Es el caso del puesto
            // incubrible: se pide cobertura y no hay un solo candidato en el catálogo.
            'sumiller' => 'Sumiller',
        ];

        $positions = [];

        foreach ($names as $key => $name) {
            $positions[$key] = $company->positions()->create([
                'name' => $name,
                'is_active' => true,
            ]);
        }

        return $positions;
    }

    /** @return array<string, Profile> */
    private function profiles(Company $company): array
    {
        return [
            'completa' => $company->profiles()->create([
                'name' => 'Indefinido · 40 h',
                'max_minutes_week' => 40 * 60,
                'max_minutes_month' => 160 * 60,
                'max_minutes_year' => 1800 * 60,
                'max_minutes_per_shift' => 9 * 60,
                'min_rest_minutes_between_shifts' => 12 * 60,
                'max_overtime_minutes_year' => 80 * 60,
                'annual_leave_days' => 22,
                'workday_type' => WorkdayType::Any,
            ]),
            'parcial25' => $company->profiles()->create([
                'name' => 'Parcial · 25 h',
                'max_minutes_week' => 25 * 60,
                'max_minutes_per_shift' => 6 * 60,
                'min_rest_minutes_between_shifts' => 12 * 60,
                'annual_leave_days' => 22,
                'workday_type' => WorkdayType::Any,
            ]),
            'parcial20' => $company->profiles()->create([
                'name' => 'Parcial · 20 h',
                'max_minutes_week' => 20 * 60,
                'max_minutes_per_shift' => 8 * 60,
                'min_rest_minutes_between_shifts' => 12 * 60,
                'annual_leave_days' => 22,
                'workday_type' => WorkdayType::Any,
            ]),
        ];
    }

    /** Los catálogos de la empresa: el motor no sabe qué es una "hora médica". */
    private function catalogue(Company $company): array
    {
        return [
            'medica' => $company->conceptTypes()->create([
                'name' => 'Hora médica',
                'computation' => Computation::Adds,
                'is_active' => true,
            ]),
            'extra' => $company->conceptTypes()->create([
                'name' => 'Hora extra',
                'computation' => Computation::SeparateCounter,
                'is_active' => true,
            ]),
            'baja' => $company->absenceTypes()->create([
                'name' => 'Baja médica',
                'computation' => Computation::Blocks,
                'scope' => AbsenceScope::Person,
                'consumes_leave_quota' => false,
                'is_active' => true,
            ]),
            'vacaciones' => $company->absenceTypes()->create([
                'name' => 'Vacaciones',
                'computation' => Computation::Blocks,
                'scope' => AbsenceScope::Employment,
                'consumes_leave_quota' => true,
                'is_active' => true,
            ]),
        ];
    }

    /** @return array<string, Person> */
    private function people(User $owner): array
    {
        $roster = [
            'ana' => ['Ana', 'López'],
            'marco' => ['Marco', 'Ruiz'],
            'sara' => ['Sara', 'Gil'],
            'lucia' => ['Lucía', 'Díaz'],
            'diego' => ['Diego', 'Mora'],
            'tomas' => ['Tomás', 'Vega'],
            'nuria' => ['Nuria', 'Peña'],
            'iker' => ['Iker', 'Blanco'],
        ];

        $people = [];

        foreach ($roster as $key => [$first, $last]) {
            $people[$key] = $owner->people()->create([
                'first_name' => $first,
                'last_name' => $last,
            ]);
        }

        return $people;
    }

    /** @return array<string, Employment> */
    private function employments(
        Company $company,
        array $people,
        array $profiles,
        array $positions,
        Calendar $calendar,
    ): array {
        $plan = [
            'ana' => ['completa', ['barra', 'sala']],
            'marco' => ['parcial25', ['barra']],
            'sara' => ['completa', ['cocina']],
            'lucia' => ['parcial25', ['sala', 'caja']],
            'diego' => ['completa', ['cocina']],
            'tomas' => ['parcial20', ['caja']],
            'nuria' => ['completa', ['cocina', 'sala']],
            'iker' => ['completa', ['barra']],
        ];

        $employments = [];

        foreach ($plan as $key => [$profile, $skills]) {
            $employment = $company->employments()->create([
                'person_id' => $people[$key]->id,
                'profile_id' => $profiles[$profile]->id,
                'starts_on' => $this->monday->subYear()->toDateString(),
                'ends_on' => null,
            ]);

            $employment->positions()->attach(
                collect($skills)->map(fn ($s) => $positions[$s]->id)->all()
            );

            $employment->calendars()->attach($calendar);

            $employments[$key] = $employment;
        }

        return $employments;
    }

    /** El encargado y la empleada. Los tres papeles, para poder verlos de verdad. */
    private function logins(User $owner, Company $optim, Person $ana): void
    {
        $encargado = User::query()->create([
            'name' => 'Nuria Peña',
            'email' => 'encargado@turnia.test',
            'password' => Hash::make('turnia'),
        ]);

        $optim->managers()->attach($encargado);

        // El login de Ana apunta a su persona: eso, y solo eso, la hace empleada.
        //
        // Y NO se puede pasar por create(): person_id está fuera de $fillable a
        // propósito (es un campo de propiedad, como company_id). Eloquent lo
        // descartaría en silencio y quedaría un login que no es de nadie.
        User::query()->create([
            'name' => 'Ana López',
            'email' => 'empleada@turnia.test',
            'password' => Hash::make('turnia'),
        ])->linkTo($ana);
    }

    /**
     * LO QUE HACE FALTA.
     *
     * Las franjas están escalonadas a propósito: "3 de barra de 12 a 16" y "2 de 16 a
     * 20" no se fusionan, y con un solo turno de 14 a 18 encima el motor tiene que
     * decir "de 12 a 14 faltan 3, de 14 a 16 faltan 2". Ese escalón es la prueba de
     * que la cobertura se calcula POR SEGMENTOS y no por franja entera.
     */
    private function demand(Calendar $calendar, array $positions): void
    {
        $from = $this->monday->subMonths(6)->toDateString();

        $requirements = [
            ['barra', '12:00', '16:00', 3],
            ['barra', '16:00', '20:00', 2],
            ['cocina', '12:00', '16:00', 1],
            ['cocina', '20:00', '23:59', 1],
            ['sala', '13:00', '17:00', 1],
            ['caja', '10:00', '18:00', 1],
            // El puesto incubrible: se pide, y no hay nadie cualificado en la plantilla.
            ['sumiller', '20:00', '23:00', 1],
        ];

        foreach ($requirements as [$position, $start, $end, $count]) {
            $calendar->coverageRequirements()->create([
                'position_id' => $positions[$position]->id,
                'effective_from' => $from,
                'effective_to' => null,
                'recurrence' => Recurrence::Daily,
                'starts_at' => $start,
                'ends_at' => $end,
                'required_count' => $count,
            ]);
        }
    }

    private function shifts(Calendar $calendar, array $employments, array $positions, User $owner): void
    {
        $company = $calendar->company;

        // --- JORNADA PARTIDA: dos bloques el mismo día, con un agujero real en medio.
        // El motor NO tiene un campo "es partida": lo es de facto, y se VE.
        $this->shift($calendar, $employments['lucia'], $positions['sala'], 1, '09:00', '13:00');
        $this->shift($calendar, $employments['lucia'], $positions['sala'], 1, '17:00', '21:00');

        // --- TURNO NOCTURNO: cruza medianoche. work_date es el día en que EMPIEZA.
        $this->shift($calendar, $employments['diego'], $positions['cocina'], 1, '22:00', '06:00');
        $this->shift($calendar, $employments['diego'], $positions['cocina'], 3, '22:00', '06:00');

        // --- HUECOS POR SEGMENTOS: un solo turno de 14 a 18 contra una demanda
        // escalonada de 3 (12-16) y 2 (16-20).
        $this->shift($calendar, $employments['iker'], $positions['barra'], 2, '14:00', '18:00');
        $this->shift($calendar, $employments['ana'], $positions['barra'], 2, '12:00', '20:00');

        // --- DOBLE EMPRESA: Marco entra en L'Òptim por la tarde... y por la mañana ya
        // ha trabajado en el Bar Central (ver elsewhere()).
        $this->shift($calendar, $employments['marco'], $positions['barra'], 1, '16:00', '20:00');

        // --- INCUMPLIMIENTO: Sara se pasa de las 40 h. Seis turnos de 7 h son 42.
        foreach ([1, 2, 3, 4, 5, 6] as $day) {
            $sara = $this->shift($calendar, $employments['sara'], $positions['cocina'], $day, '12:00', '19:00');
        }

        // El humano lo DECIDIÓ y quedó constancia. Un turno forzado no es lo mismo que
        // un turno que nadie ha revisado, y la parrilla los distingue.
        $sara->override()->create([
            'user_id' => $owner->id,
            'reason' => 'Cubre la baja de Ana. Se compensa la semana que viene.',
            'violations' => [['code' => 'hour_limit', 'severity' => 'breach']],
        ]);

        // --- IMPOSIBLE: Tomás no puede estar en dos sitios a la vez. Y sin embargo aquí
        // está: alguien lo colocó. La parrilla tiene que GRITARLO.
        $this->shift($calendar, $employments['tomas'], $positions['caja'], 2, '10:00', '18:00');
        $this->shift($calendar, $employments['tomas'], $positions['caja'], 2, '14:00', '20:00');

        // --- HUÉRFANAS: Ana tiene turnos el miércoles y el jueves... y va a caer de
        // baja justo esos días.
        $this->shift($calendar, $employments['ana'], $positions['barra'], 3, '12:00', '20:00');
        $this->shift($calendar, $employments['ana'], $positions['sala'], 4, '13:00', '17:00');

        // Relleno creíble.
        $this->shift($calendar, $employments['nuria'], $positions['cocina'], 4, '12:00', '16:00');
        $this->shift($calendar, $employments['nuria'], $positions['sala'], 5, '13:00', '17:00');
        $this->shift($calendar, $employments['iker'], $positions['barra'], 5, '12:00', '20:00');
        $this->shift($calendar, $employments['lucia'], $positions['caja'], 5, '10:00', '16:00');
        $this->shift($calendar, $employments['tomas'], $positions['caja'], 6, '10:00', '16:00');

        unset($company);
    }

    /**
     * Un turno, en horas LOCALES de la empresa, guardado como instante UTC.
     *
     * Si el fin va antes que el inicio, cruza medianoche: eso NO es un caso especial,
     * es lo que hace un turno de noche.
     */
    private function shift(
        Calendar $calendar,
        Employment $employment,
        Position $position,
        int $isoDay,
        string $start,
        string $end,
    ): Assignment {
        $company = $calendar->company;
        $workDate = $this->monday->addDays($isoDay - 1);

        $startsAt = $company->toUtc($workDate->toDateString(), $start);
        $endsAt = $company->toUtc($workDate->toDateString(), $end);

        if ($endsAt->lte($startsAt)) {
            $endsAt = $company->toUtc($workDate->addDay()->toDateString(), $end);
        }

        return $calendar->assignments()->create([
            'employment_id' => $employment->id,
            'position_id' => $position->id,
            'work_date' => $workDate->toDateString(),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ]);
    }

    /**
     * Los conceptos horarios: ocupan a la persona pero NO cubren puesto.
     *
     * La hora médica de Nuria cae dentro de su turno: se ve, en el mismo eje, que a
     * las 10 no está en la cocina.
     */
    private function concepts(array $employments, array $catalogue): void
    {
        $company = $employments['nuria']->company;
        $martes = $this->monday->addDay();

        $employments['nuria']->conceptEntries()->create([
            'concept_type_id' => $catalogue['medica']->id,
            'work_date' => $martes->toDateString(),
            'starts_at' => $company->toUtc($martes->toDateString(), '10:00'),
            'ends_at' => $company->toUtc($martes->toDateString(), '11:30'),
        ]);

        $viernes = $this->monday->addDays(4);

        $employments['iker']->conceptEntries()->create([
            'concept_type_id' => $catalogue['extra']->id,
            'work_date' => $viernes->toDateString(),
            'starts_at' => $company->toUtc($viernes->toDateString(), '20:00'),
            'ends_at' => $company->toUtc($viernes->toDateString(), '22:00'),
        ]);
    }

    /**
     * LA BAJA QUE DEJA HUÉRFANAS.
     *
     * Ana cae de baja de miércoles a viernes. Sus turnos del miércoles y del jueves
     * siguen ahí: NADIE los ha quitado, porque el motor informa pero no decide. Esos
     * huecos hay que verlos.
     */
    private function absences(array $employments, array $people, array $catalogue): void
    {
        $employments['ana']->absences()->create([
            'person_id' => $people['ana']->id,
            'absence_type_id' => $catalogue['baja']->id,
            'starts_on' => $this->monday->addDays(2)->toDateString(),
            'ends_on' => $this->monday->addDays(4)->toDateString(),
            'notes' => 'Parte de baja por gripe.',
        ]);

        $employments['tomas']->absences()->create([
            'person_id' => $people['tomas']->id,
            'absence_type_id' => $catalogue['vacaciones']->id,
            'starts_on' => $this->monday->addWeek()->toDateString(),
            'ends_on' => $this->monday->addWeek()->addDays(6)->toDateString(),
        ]);
    }

    /**
     * EL OTRO BAR.
     *
     * Marco tiene contrato en las dos empresas del dueño. El lunes por la mañana está
     * en el Bar Central y por la tarde en L'Òptim: no se solapan, así que no es
     * imposible, y son el mismo work_date, así que el descanso no dice nada. Es
     * exactamente el punto ciego que el aviso de jornada compartida existe para tapar.
     *
     * Y el encargado de L'Òptim verá el aviso SIN el nombre del Bar Central.
     */
    private function elsewhere(Company $central, Person $marco, array $optimProfiles): void
    {
        unset($optimProfiles);

        $profile = $central->profiles()->create([
            'name' => 'Parcial · 15 h',
            'max_minutes_week' => 15 * 60,
            'min_rest_minutes_between_shifts' => 12 * 60,
            'workday_type' => WorkdayType::Any,
        ]);

        $barra = $central->positions()->create(['name' => 'Barra', 'is_active' => true]);

        $calendar = $central->calendars()->create([
            'name' => 'Barra',
            'starts_on' => $this->monday->subMonths(6)->toDateString(),
            'is_active' => true,
        ]);

        $employment = $central->employments()->create([
            'person_id' => $marco->id,
            'profile_id' => $profile->id,
            'starts_on' => $this->monday->subYear()->toDateString(),
        ]);

        $employment->positions()->attach($barra);
        $employment->calendars()->attach($calendar);

        $this->shift($calendar, $employment, $barra, 1, '08:00', '12:00');
    }
}
