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
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * EL BAR DE LA DEMO.
 *
 * ⚠️ UN CUADRANTE EN LLAMAS NO IMPRESIONA: ALARMA.
 *
 * La primera versión de este seeder estaba llena de rojos: Ana de baja Y asignada tres
 * días, Sara pasándose de horas todos los días, imposibles repetidos. Quien lo abría no
 * sabía si la app funcionaba bien detectando problemas o si estaba rota. Más rojo que
 * verde no demuestra que haya un motor: demuestra que hay un desastre.
 *
 * LO QUE DEMUESTRA QUE EL MOTOR SIRVE ES UN CUADRANTE SANO CON UN PUÑADO DE PROBLEMAS
 * SEÑALADOS. Así que aquí la semana está MAYORMENTE VERDE, y los casos difíciles son
 * UNO DE CADA, puestos a mano y en un sitio concreto:
 *
 *   · UNA jornada partida ......... Lucía, el lunes (dos barras con un agujero real)
 *   · UN turno nocturno ........... Diego, de lunes a viernes (cruza el borde del día)
 *   · UN aviso de doble empresa ... Marco, el miércoles (sin decir dónde)
 *   · UN incumplimiento forzado ... Sara, el lunes (descanso corto), con constancia
 *   · UN imposible ................ Tomás, el martes (se solapa consigo mismo)
 *   · UNA baja .................... Ana, de miércoles a viernes — Y SIN TURNOS ESOS DÍAS
 *   · UN puesto sin candidato ..... Sumiller, el sábado
 *   · UN escalón de cobertura ..... Barra, el sábado: faltan 3, luego faltan 2
 *
 * Todo lo demás, verde.
 */
class DemoSeeder extends Seeder
{
    private CarbonImmutable $monday;

    /** @var array<string, Position> */
    private array $positions = [];

    /** @var array<string, Employment> */
    private array $employments = [];

    private Calendar $calendar;

    public function run(): void
    {
        // La semana en curso: la demo siempre enseña algo al abrirla.
        $this->monday = CarbonImmutable::today()->startOfWeek(CarbonImmutable::MONDAY);

        $owner = $this->owner();
        $optim = $this->optim($owner);

        $this->positions = $this->positions($optim);
        $profiles = $this->profiles($optim);
        $catalogue = $this->catalogue($optim);

        $this->calendar = $optim->calendars()->create([
            'name' => 'Sala y barra',
            'starts_on' => $this->monday->subMonths(6)->toDateString(),
            'ends_on' => null,
            'is_active' => true,
        ]);

        $people = $this->people($owner);
        $this->employments = $this->employments($optim, $people, $profiles);

        $this->logins($owner, $optim, $people['ana']);
        $this->demand();

        // La semana que funciona. Es la mayor parte de lo que se ve.
        $this->rota();

        // Y los ocho casos difíciles, uno a uno.
        $this->jornadaPartida();
        $this->turnoNocturno();
        $this->descansoCortoForzado($owner);
        $this->solapeImposible();
        $this->bajaSinTurnos($people, $catalogue);
        $this->conceptosHorarios($catalogue);
        $this->dobleEmpresa($owner, $people['marco']);
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
            // Un bar abre los siete días. Ningún día es "no laborable".
            'non_working_weekdays' => [],
        ]);
    }

    /** @return array<string, Position> */
    private function positions(Company $company): array
    {
        $names = [
            'barra' => 'Barra',
            'cocina' => 'Cocina',
            'sala' => 'Sala',
            'caja' => 'Caja',
            // ⚠️ NADIE va a estar cualificado para esto. Es el puesto incubrible.
            'sumiller' => 'Sumiller',
        ];

        $positions = [];

        foreach ($names as $key => $name) {
            $positions[$key] = $company->positions()->create(['name' => $name, 'is_active' => true]);
        }

        return $positions;
    }

    private function profiles(Company $company): array
    {
        return [
            'completa' => $company->profiles()->create([
                'name' => 'Indefinido · 40 h',
                'max_minutes_week' => 40 * 60,
                'max_minutes_month' => 170 * 60,
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
                'max_minutes_per_shift' => 8 * 60,
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
            'iker' => ['Iker', 'Blanco'],
            'marco' => ['Marco', 'Ruiz'],
            'nuria' => ['Nuria', 'Peña'],
            'sara' => ['Sara', 'Gil'],
            'diego' => ['Diego', 'Mora'],
            'lucia' => ['Lucía', 'Díaz'],
            'bea' => ['Bea', 'Soler'],
            'leo' => ['Leo', 'Ferrer'],
            'tomas' => ['Tomás', 'Vega'],
        ];

        $people = [];

        foreach ($roster as $key => [$first, $last]) {
            $people[$key] = $owner->people()->create(['first_name' => $first, 'last_name' => $last]);
        }

        return $people;
    }

    /** @return array<string, Employment> */
    private function employments(Company $company, array $people, array $profiles): array
    {
        $plan = [
            'ana' => ['completa', ['barra', 'sala']],
            'iker' => ['completa', ['barra']],
            'marco' => ['parcial25', ['barra']],
            'nuria' => ['completa', ['barra', 'sala']],
            'sara' => ['completa', ['cocina']],
            'diego' => ['completa', ['cocina']],
            'lucia' => ['parcial25', ['sala', 'caja']],
            'bea' => ['completa', ['sala']],
            'leo' => ['completa', ['caja']],
            'tomas' => ['parcial20', ['caja']],
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
                collect($skills)->map(fn ($s) => $this->positions[$s]->id)->all()
            );

            $employment->calendars()->attach($this->calendar);

            $employments[$key] = $employment;
        }

        return $employments;
    }

    private function logins(User $owner, Company $optim, Person $ana): void
    {
        $encargado = User::query()->create([
            'name' => 'Nuria Peña',
            'email' => 'encargado@turnia.test',
            'password' => Hash::make('turnia'),
        ]);

        $optim->managers()->attach($encargado);

        // person_id NO es fillable: es un campo de propiedad. linkTo(), no create().
        User::query()->create([
            'name' => 'Ana López',
            'email' => 'empleada@turnia.test',
            'password' => Hash::make('turnia'),
        ])->linkTo($ana);
    }

    /**
     * LO QUE HACE FALTA.
     *
     * Está declarado para que la plantilla LO CUBRA. Un cuadrante que no se puede cubrir
     * con la gente que hay no demuestra que el motor funcione: demuestra que el catálogo
     * está mal. Solo hay dos huecos, y los dos son a propósito.
     */
    private function demand(): void
    {
        // Barra: dos personas, todos los días menos el sábado.
        foreach ([1, 2, 3, 4, 5, 7] as $day) {
            $this->requirement('barra', '12:00', '20:00', 2, $day);
        }

        /*
         * EL ESCALÓN DE COBERTURA, y solo el SÁBADO.
         *
         * El sábado hay más gente y hacen falta 5 de barra al mediodía y 4 por la tarde.
         * Solo se colocan 2 → "faltan 3" de 12 a 16 y "faltan 2" de 16 a 20.
         *
         * Es la prueba de que la cobertura se calcula POR SEGMENTOS: el motor no dice
         * "falta gente el sábado" —que sería un aviso falso—, dice exactamente dónde y
         * cuánta, y cada tramo se pinta con su anchura real.
         */
        $this->requirement('barra', '12:00', '16:00', 5, 6);
        $this->requirement('barra', '16:00', '20:00', 4, 6);

        // Cocina: de lunes a viernes. El turno de noche cruza medianoche.
        foreach ([1, 2, 3, 4, 5] as $day) {
            $this->requirement('cocina', '08:00', '16:00', 1, $day);
            $this->requirement('cocina', '22:00', '06:00', 1, $day);
        }

        // Sala: de lunes a viernes, en tres tramos.
        foreach ([1, 2, 3, 4, 5] as $day) {
            $this->requirement('sala', '09:00', '13:00', 1, $day);
            $this->requirement('sala', '13:00', '17:00', 1, $day);
            $this->requirement('sala', '17:00', '21:00', 1, $day);
        }

        // Caja: de lunes a sábado.
        foreach ([1, 2, 3, 4, 5, 6] as $day) {
            $this->requirement('caja', '10:00', '18:00', 1, $day);
        }

        // EL PUESTO INCUBRIBLE: se pide un sumiller el sábado y no hay ni uno cualificado.
        $this->requirement('sumiller', '20:00', '23:00', 1, 6);
    }

    private function requirement(string $position, string $start, string $end, int $count, int $isoDay): void
    {
        $this->calendar->coverageRequirements()->create([
            'position_id' => $this->positions[$position]->id,
            'effective_from' => $this->monday->subMonths(6)->toDateString(),
            'recurrence' => Recurrence::Weekly,
            'day_of_week' => $isoDay,
            'starts_at' => $start,
            'ends_at' => $end,
            'required_count' => $count,
        ]);
    }

    /**
     * LA SEMANA QUE FUNCIONA.
     *
     * Todo esto sale VERDE. Es lo que hace creíble el cuadrante y lo que da sentido a los
     * pocos avisos que sí hay: sobre un fondo de errores, un aviso no dice nada.
     */
    private function rota(): void
    {
        // BARRA — dos personas de 12 a 20. Ana libra miércoles, jueves y viernes: está de
        // baja, y por eso NO tiene turnos esos días (la baja no deja huérfanas).
        foreach ([1, 2, 7] as $day) {
            $this->shift('ana', 'barra', $day, '12:00', '20:00');
        }
        foreach ([1, 2, 3, 4, 5] as $day) {
            $this->shift('iker', 'barra', $day, '12:00', '20:00');
        }
        foreach ([3, 4, 5] as $day) {
            $this->shift('marco', 'barra', $day, '12:00', '20:00');
        }
        // El sábado, Ana y Nuria: son 2 de los 5 que se piden. Ahí está el escalón.
        $this->shift('ana', 'barra', 6, '12:00', '20:00');
        foreach ([6, 7] as $day) {
            $this->shift('nuria', 'barra', $day, '12:00', '20:00');
        }

        // COCINA de día — Sara, de lunes a viernes. (El lunes es el turno forzado: ver
        // descansoCortoForzado()).
        foreach ([2, 3, 4, 5] as $day) {
            $this->shift('sara', 'cocina', $day, '08:00', '16:00');
        }

        // SALA — Bea cubre el mediodía toda la semana y la tarde de martes a viernes.
        // (El lunes por la tarde es de Lucía: ver jornadaPartida()).
        foreach ([1, 2, 3, 4, 5] as $day) {
            $this->shift('bea', 'sala', $day, '13:00', '17:00');
        }
        foreach ([2, 3, 4, 5] as $day) {
            $this->shift('bea', 'sala', $day, '17:00', '21:00');
            $this->shift('lucia', 'sala', $day, '09:00', '13:00');
        }

        // CAJA — Leo, todos los días menos el martes (ese es el de Tomás: ver
        // solapeImposible()).
        foreach ([1, 3, 4, 5, 6] as $day) {
            $this->shift('leo', 'caja', $day, '10:00', '18:00');
        }
    }

    /**
     * UNA JORNADA PARTIDA. Lucía, el lunes: de 9 a 13 y de 17 a 21.
     *
     * El modelo no tiene un campo "es partida": son dos filas el mismo día. Y en la
     * parrilla se VE, porque las barras se posicionan por su hora real y entre ellas queda
     * un agujero físico. No hay que leerlo.
     */
    private function jornadaPartida(): void
    {
        $this->shift('lucia', 'sala', 1, '09:00', '13:00');
        $this->shift('lucia', 'sala', 1, '17:00', '21:00');
    }

    /**
     * UN TURNO NOCTURNO. Diego, de lunes a viernes: de 22:00 a 06:00.
     *
     * work_date es el día en que EMPIEZA. En el eje va de la hora 22 a la 30, así que la
     * barra se ve CRUZANDO el borde del día. Y el contador saca 8 horas de verdad, porque
     * mide sobre instantes UTC: la noche del cambio de hora saldrían 9, sin ningún caso
     * especial.
     */
    private function turnoNocturno(): void
    {
        foreach ([1, 2, 3, 4, 5] as $day) {
            $this->shift('diego', 'cocina', $day, '22:00', '06:00');
        }
    }

    /**
     * UN INCUMPLIMIENTO FORZADO. Sara, el lunes: 8 horas de descanso donde el perfil exige 12.
     *
     * ⚠️ POR QUÉ NO ES "41 DE 40 HORAS", QUE ES LO QUE PEDÍA LA REFERENCIA.
     *
     * Porque el motor es de verdad. Si una semana se pasa del tope, la regla del tope salta
     * en TODOS los turnos de esa semana —cada uno, al revalidarse, ve que el total quedaría
     * en 41 de 40—, y la fila entera de Sara se pinta de naranja los cinco días. Eso es
     * exactamente el "cuadrante en llamas" que hay que evitar: correcto, y ensordecedor.
     *
     * El descanso corto, en cambio, es una regla POR TURNO: salta en uno y solo en uno. Es
     * lo mismo que hace la referencia, cuyo aviso es literalmente "Forzado · descanso 8 h".
     *
     * El turno de la víspera (domingo pasado, fuera de la semana visible) es lo que deja el
     * descanso en 8 horas. El de esa noche a las 16:00, este a las 08:00 del lunes.
     */
    private function descansoCortoForzado(User $owner): void
    {
        // La víspera: fuera de la ventana que se pinta, pero el motor la ve.
        $this->shift('sara', 'cocina', 0, '16:00', '24:00');

        $forzado = $this->shift('sara', 'cocina', 1, '08:00', '16:00');

        // El humano lo DECIDIÓ, y quedó constancia. Un turno forzado no es lo mismo que un
        // turno que nadie ha revisado, y la parrilla los distingue.
        $forzado->override()->create([
            'user_id' => $owner->id,
            'reason' => 'Cubre el cierre de la noche anterior. Se compensa el jueves.',
            'violations' => [['code' => 'minimum_rest', 'severity' => 'breach']],
        ]);
    }

    /**
     * UN IMPOSIBLE. Tomás, el martes: dos turnos de caja que se pisan.
     *
     * No puede estar en dos sitios a la vez, y sin embargo ahí está: alguien lo colocó. La
     * parrilla tiene que GRITARLO, y la cobertura de esa celda desaparece — con alguien que
     * no puede estar ahí, el número contaría a quien no puede cubrir.
     */
    private function solapeImposible(): void
    {
        $this->shift('tomas', 'caja', 2, '10:00', '18:00');
        $this->shift('tomas', 'caja', 2, '14:00', '20:00');
    }

    /**
     * UNA BAJA. Ana, de miércoles a viernes. Y SIN TURNOS ESOS DÍAS.
     *
     * Es la diferencia entre una demo y un desastre: una baja bien gestionada deja la banda
     * índigo atravesando los días, el hueco cubierto por Marco, y ni un solo rojo.
     */
    private function bajaSinTurnos(array $people, array $catalogue): void
    {
        $this->employments['ana']->absences()->create([
            'person_id' => $people['ana']->id,
            'absence_type_id' => $catalogue['baja']->id,
            'starts_on' => $this->monday->addDays(2)->toDateString(),
            'ends_on' => $this->monday->addDays(4)->toDateString(),
            'notes' => 'Parte de baja por gripe.',
        ]);

        // Y unas vacaciones la semana que viene, para que el cupo tenga algo que contar.
        $this->employments['tomas']->absences()->create([
            'person_id' => $people['tomas']->id,
            'absence_type_id' => $catalogue['vacaciones']->id,
            'starts_on' => $this->monday->addWeek()->toDateString(),
            'ends_on' => $this->monday->addWeek()->addDays(6)->toDateString(),
        ]);
    }

    /**
     * LOS CONCEPTOS HORARIOS: ocupan a la persona, pero NO cubren puesto.
     *
     * Van en el carril de la persona y en el mismo eje que sus turnos, así que se VE que esa
     * mañana no está disponible aunque ese día trabaje.
     *
     * ⚠️ FUERA del turno, no dentro: dentro sería IMPOSIBLE, y el motor tiene razón — no se
     * puede estar en el médico y cubriendo la barra a la vez.
     */
    private function conceptosHorarios(array $catalogue): void
    {
        $company = $this->calendar->company;

        // Nuria, el sábado: al médico a las 9, y a la barra a las 12.
        $sabado = $this->monday->addDays(5);

        $this->employments['nuria']->conceptEntries()->create([
            'concept_type_id' => $catalogue['medica']->id,
            'work_date' => $sabado->toDateString(),
            'starts_at' => $company->toUtc($sabado->toDateString(), '09:00'),
            'ends_at' => $company->toUtc($sabado->toDateString(), '11:00'),
        ]);

        // Iker, el viernes: dos horas extra pegadas a su turno. Van a un contador APARTE,
        // con su propio tope: no engordan las horas ordinarias.
        $viernes = $this->monday->addDays(4);

        $this->employments['iker']->conceptEntries()->create([
            'concept_type_id' => $catalogue['extra']->id,
            'work_date' => $viernes->toDateString(),
            'starts_at' => $company->toUtc($viernes->toDateString(), '20:00'),
            'ends_at' => $company->toUtc($viernes->toDateString(), '22:00'),
        ]);
    }

    /**
     * UN AVISO DE DOBLE EMPRESA. Marco, el miércoles.
     *
     * Por la mañana está en el Bar Central y por la tarde en L'Òptim. No se solapan, así que
     * no es imposible; y son el mismo work_date, así que el descanso no dice nada. Es
     * exactamente el punto ciego que el aviso de jornada compartida existe para tapar: cada
     * encargado cree que le está dando media jornada y ninguno sabe que está encadenando dos.
     *
     * Y el encargado de L'Òptim verá el aviso SIN el nombre del Bar Central.
     */
    private function dobleEmpresa(User $owner, Person $marco): void
    {
        $central = $owner->companies()->create([
            'name' => 'Bar Central',
            'timezone' => 'Europe/Madrid',
            'computation_year_start_month' => 1,
            'computation_year_start_day' => 1,
            'non_working_weekdays' => [],
        ]);

        $profile = $central->profiles()->create([
            'name' => 'Parcial · 15 h',
            'max_minutes_week' => 15 * 60,
            'max_minutes_per_shift' => 8 * 60,
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

        $miercoles = $this->monday->addDays(2);

        $calendar->assignments()->create([
            'employment_id' => $employment->id,
            'position_id' => $barra->id,
            'work_date' => $miercoles->toDateString(),
            'starts_at' => $central->toUtc($miercoles->toDateString(), '08:00'),
            'ends_at' => $central->toUtc($miercoles->toDateString(), '11:00'),
        ]);
    }

    /**
     * Un turno, en horas LOCALES de la empresa, guardado como instante UTC.
     *
     * $isoDay 1 = lunes … 7 = domingo. 0 = el domingo ANTERIOR (fuera de la semana visible).
     *
     * Si el fin va antes que el inicio, cruza medianoche: no es un caso especial, es lo que
     * hace un turno de noche.
     */
    private function shift(string $who, string $position, int $isoDay, string $start, string $end): Assignment
    {
        $employment = $this->employments[$who];
        $company = $employment->company;
        $workDate = $this->monday->addDays($isoDay - 1);

        $startsAt = $company->toUtc($workDate->toDateString(), $start);

        $endsAt = $end === '24:00'
            ? $company->toUtc($workDate->addDay()->toDateString(), '00:00')
            : $company->toUtc($workDate->toDateString(), $end);

        if ($endsAt->lte($startsAt)) {
            $endsAt = $company->toUtc($workDate->addDay()->toDateString(), $end);
        }

        return $this->calendar->assignments()->create([
            'employment_id' => $employment->id,
            'position_id' => $this->positions[$position]->id,
            'work_date' => $workDate->toDateString(),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ]);
    }
}
