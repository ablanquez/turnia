<?php

namespace Database\Seeders;

use App\Enums\Recurrence;
use App\Enums\WorkdayType;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\Employment;
use App\Models\Position;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * LOS ESCENARIOS DEL BACKTESTING. DATOS DE VERDAD, EN LA BASE DE VERDAD.
 *
 * ⚠️ ESTE SEEDER EXISTE PARA QUE LAS COMPROBACIONES SE HAGAN SOBRE LA PÁGINA, NO EN MEMORIA.
 *
 * Un test que monta el escenario en un array y comprueba el array no prueba nada sobre lo
 * que se ve. Ya me ha pasado tres veces: "27 tramos verdes" era cierto en el array y falso
 * en la pantalla; el panel "salía" en una captura de 2.640 px y estaba fuera de un navegador
 * real; el detector de scroll le preguntaba al panel recogido y daba verde.
 *
 * Así que cada caso difícil se SIEMBRA aquí, y luego se abre en Chromium a 1366 px y se le
 * pregunta al navegador qué ha pintado (tests/Visual/backtest.mjs).
 *
 * CADA ESCENARIO EN SU PROPIA EMPRESA, y no es manía de aislamiento: si compartieran
 * empresa, los turnos de un escenario se solaparían con los de otro para la misma persona y
 * el motor —con razón— empezaría a gritar imposibles que no ha puesto nadie. El escenario
 * "semana perfecta" saldría rojo por culpa del escenario de al lado.
 *
 *   php artisan migrate:fresh --seed
 *   php artisan db:seed --class=BacktestSeeder
 *   node tests/Visual/backtest.mjs
 */
class BacktestSeeder extends Seeder
{
    /** Una semana FIJA y futura: los escenarios no pueden cambiar de resultado según el día que se corran. */
    private CarbonImmutable $monday;

    private User $owner;

    /** @var array<int, array<string, string>> */
    private array $index = [];

    public function run(): void
    {
        $this->monday = CarbonImmutable::parse('2026-08-03');

        $this->owner = User::query()->firstWhere('email', 'demo@turnia.test')
            ?? User::factory()->create(['email' => 'demo@turnia.test']);

        $this->semanaVacia();
        $this->huecosSinViolaciones();
        $this->semanaPerfecta();
        $this->violacionesSinHuecos();
        $this->imposibleConRequisito();
        $this->imposibleSinRequisito();
        $this->sinCandidatoConDeficit();
        $this->sinCandidatoSinDeficit();
        $this->tresSolapes();
        $this->partidaDeTresBloques();
        $this->nocturnoHastaElFilo();
        $this->madrugadorFueraDelEje();
        $this->nombreLarguisimo();

        file_put_contents(
            base_path('tests/Visual/escenarios.json'),
            json_encode([
                'monday' => $this->monday->toDateString(),
                'escenarios' => $this->index,
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    /**
     * 1. LA SEMANA VACÍA. Se pide gente todos los días y no hay ni un turno.
     *
     * ⚠️ EL PEOR CUADRANTE POSIBLE, Y EL INDICADOR LO ANUNCIABA COMO EL MEJOR.
     *
     * Nadie incumple —no hay a quién— así que el contador de incidencias daba cero y la
     * cabecera decía "Sin incidencias" en verde. Un cuadrante perfecto y un cuadrante
     * inexistente daban el mismo número.
     */
    private function semanaVacia(): void
    {
        [$company, $calendar] = $this->company('vacia', 'Semana vacía');

        $barra = $this->position($company, 'Barra');

        // Hay quien podría cubrirlo (no es un problema de catálogo): simplemente no se ha
        // colocado a nadie. Sin esto, el hueco saldría como "sin candidato" y sería otro caso.
        $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        $this->demand($calendar, $barra, '12:00', '20:00', 2);
    }

    /** 2. Huecos PERO sin un solo incumplimiento: falta gente y nadie incumple nada. */
    private function huecosSinViolaciones(): void
    {
        [$company, $calendar] = $this->company('huecos-sin-violaciones', 'Huecos sin violaciones');

        $barra = $this->position($company, 'Barra');
        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        // Se piden 2 y se coloca 1: falta uno cada día, todos los días.
        $this->demand($calendar, $barra, '12:00', '20:00', 2);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }
    }

    /** 3. La semana SANA: cobertura exacta y ni un aviso. Aquí —y solo aquí— toca el verde. */
    private function semanaPerfecta(): void
    {
        [$company, $calendar] = $this->company('perfecta', 'Semana perfecta');

        $barra = $this->position($company, 'Barra');
        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        $this->demand($calendar, $barra, '12:00', '20:00', 1);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }
    }

    /**
     * 4. Incumplimientos PERO sin huecos: la cobertura cuadra y aun así algo va mal.
     *
     * El indicador no puede quedarse callado solo porque los puestos estén cubiertos.
     */
    private function violacionesSinHuecos(): void
    {
        [$company, $calendar] = $this->company('violaciones-sin-huecos', 'Violaciones sin huecos');

        $barra = $this->position($company, 'Barra');

        // Descanso mínimo de 14 h: el turno de la víspera lo rompe.
        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra], ['min_rest_minutes_between_shifts' => 14 * 60]);

        $this->demand($calendar, $barra, '12:00', '20:00', 1);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }

        // El domingo ANTERIOR, fuera de la semana visible: acaba a medianoche y el lunes
        // entra a las 12:00. Son 12 h de descanso donde el perfil exige 14.
        $this->shift($calendar, $ana, $barra, 0, '16:00', '24:00');
    }

    /**
     * 5. UN IMPOSIBLE EN UN PUESTO QUE SÍ SE PIDE. El caso del punto 2 del informe.
     *
     * Tomás está en Caja de 10 a 18 y de 14 a 20 a la vez. No puede, así que en Caja NO HAY
     * NADIE: el déficit real es 1 durante las diez horas. La celda pintaba la tira EN BLANCO
     * —"con un imposible dentro la cobertura es una ficción"— y el resultado era una celda
     * muda sobre un puesto descubierto.
     */
    private function imposibleConRequisito(): void
    {
        [$company, $calendar] = $this->company('imposible-con-requisito', 'Imposible con requisito');

        $caja = $this->position($company, 'Caja');
        $tomas = $this->hire($company, $calendar, 'Tomás', 'Vega', [$caja]);

        $this->demand($calendar, $caja, '10:00', '20:00', 1);

        $this->shift($calendar, $tomas, $caja, 2, '10:00', '18:00');
        $this->shift($calendar, $tomas, $caja, 2, '14:00', '20:00');
    }

    /**
     * 6. UN IMPOSIBLE EN UN PUESTO QUE NADIE PIDE. ¿Y aquí qué se pinta?
     *
     * Nada en la tira, y es lo correcto: si no se pide gente en ese puesto, que Tomás no
     * pueda estar ahí no deja ningún hueco. Inventarle un déficit sería un aviso falso.
     * El imposible se sigue gritando con el rótulo rojo, que es donde toca.
     */
    private function imposibleSinRequisito(): void
    {
        [$company, $calendar] = $this->company('imposible-sin-requisito', 'Imposible sin requisito');

        $caja = $this->position($company, 'Caja');
        $barra = $this->position($company, 'Barra');

        $tomas = $this->hire($company, $calendar, 'Tomás', 'Vega', [$caja]);
        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        // La demanda está en BARRA, y está cubierta. En CAJA no se pide a nadie.
        $this->demand($calendar, $barra, '12:00', '20:00', 1);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }

        $this->shift($calendar, $tomas, $caja, 2, '10:00', '18:00');
        $this->shift($calendar, $tomas, $caja, 2, '14:00', '20:00');
    }

    /**
     * 7. SIN CANDIDATO **Y** CON DÉFICIT. Las dos cosas a la vez, y las dos se tienen que ver.
     *
     * ⚠️ AQUÍ SE PERDÍA UN DATO AL PINTARLO.
     *
     * El tramo del sumiller ponía "sin…" —truncado— y el déficit no aparecía por ningún
     * lado. Son DOS informaciones: cuánta gente falta (-1) y que no hay a quién poner. Que
     * nadie pueda cubrirlo no hace que falte menos gente.
     */
    private function sinCandidatoConDeficit(): void
    {
        [$company, $calendar] = $this->company('sin-candidato-con-deficit', 'Sin candidato con déficit');

        $barra = $this->position($company, 'Barra');
        // NADIE se contrata para esto. Es el puesto incubrible.
        $sumiller = $this->position($company, 'Sumiller');

        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        $this->demand($calendar, $barra, '12:00', '20:00', 1);
        $this->demand($calendar, $sumiller, '20:00', '23:00', 1);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }
    }

    /**
     * 8. SIN CANDIDATO Y SIN DÉFICIT: el puesto no tiene a nadie cualificado, pero es que ese
     * día tampoco se pide a nadie.
     *
     * Lo que se ve: la banda ámbar de catálogo (el problema es de configuración y sigue
     * estando) y NADA en las celdas de los seis días en que no se pide gente. No se inventa
     * un hueco donde nadie ha pedido nada.
     */
    private function sinCandidatoSinDeficit(): void
    {
        [$company, $calendar] = $this->company('sin-candidato-sin-deficit', 'Sin candidato sin déficit');

        $barra = $this->position($company, 'Barra');
        $sumiller = $this->position($company, 'Sumiller');

        $ana = $this->hire($company, $calendar, 'Ana', 'López', [$barra]);

        $this->demand($calendar, $barra, '12:00', '20:00', 1);

        // Solo el LUNES. Los otros seis días, el sumiller no se pide.
        $this->demand($calendar, $sumiller, '20:00', '23:00', 1, [1]);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $ana, $barra, $d, '12:00', '20:00');
        }
    }

    /** 9. TRES turnos solapados de la misma persona. Tres barras y —ahora— TRES rótulos. */
    private function tresSolapes(): void
    {
        [$company, $calendar] = $this->company('tres-solapes', 'Tres solapes');

        $caja = $this->position($company, 'Caja');
        $tomas = $this->hire($company, $calendar, 'Tomás', 'Vega', [$caja]);

        $this->shift($calendar, $tomas, $caja, 2, '08:00', '16:00');
        $this->shift($calendar, $tomas, $caja, 2, '10:00', '18:00');
        $this->shift($calendar, $tomas, $caja, 2, '12:00', '20:00');
    }

    /**
     * 10. UNA JORNADA PARTIDA DE TRES BLOQUES: 9–12, 14–17 y 20–23.
     *
     * Tres barras EN LA MISMA LÍNEA (no se pisan), con dos agujeros físicos entre ellas. Y
     * tres rótulos, uno por barra.
     *
     * ⚠️ Y NINGÚN FILTRO QUE LO IMPIDA. Colocar a la misma persona tres veces el mismo día
     * en el mismo puesto es LEGÍTIMO: es una jornada partida, no un error.
     */
    private function partidaDeTresBloques(): void
    {
        [$company, $calendar] = $this->company('partida-tres-bloques', 'Partida de tres bloques');

        $sala = $this->position($company, 'Sala');
        $lucia = $this->hire($company, $calendar, 'Lucía', 'Díaz', [$sala]);

        $this->shift($calendar, $lucia, $sala, 1, '09:00', '12:00');
        $this->shift($calendar, $lucia, $sala, 1, '14:00', '17:00');
        $this->shift($calendar, $lucia, $sala, 1, '20:00', '23:00');
    }

    /**
     * 11. EL NOCTURNO: de 22:00 a 06:00, y el eje acaba a las 06:00.
     *
     * La barra tiene que LLEGAR AL FILO DERECHO de la pista. Si muere antes, la hora está mal
     * puesta y el turno de noche —la excepción que más cuesta ver en un cuadrante— se estaría
     * pintando más corto de lo que es.
     */
    private function nocturnoHastaElFilo(): void
    {
        [$company, $calendar] = $this->company('nocturno', 'Nocturno hasta el filo');

        $cocina = $this->position($company, 'Cocina');
        $diego = $this->hire($company, $calendar, 'Diego', 'Mora', [$cocina]);

        $this->demand($calendar, $cocina, '22:00', '06:00', 1);

        for ($d = 1; $d <= 5; $d++) {
            $this->shift($calendar, $diego, $cocina, $d, '22:00', '06:00');
        }
    }

    /**
     * 12. EL MADRUGADOR: entra a las 05:00, ANTES del comienzo del eje.
     *
     * El eje arranca a las 06:00 por defecto, así que este turno se sale por la izquierda. La
     * regla es que EL EJE SE ENSANCHA, nunca recorta: una barra recortada es una mentira
     * dibujada, y encima parece un dato.
     */
    private function madrugadorFueraDelEje(): void
    {
        [$company, $calendar] = $this->company('madrugador', 'Madrugador fuera del eje');

        $cocina = $this->position($company, 'Cocina');
        $sara = $this->hire($company, $calendar, 'Sara', 'Gil', [$cocina]);

        $this->demand($calendar, $cocina, '05:00', '13:00', 1);

        for ($d = 1; $d <= 5; $d++) {
            $this->shift($calendar, $sara, $cocina, $d, '05:00', '13:00');
        }
    }

    /**
     * 13. UN NOMBRE QUE NO CABE. Nunca se trunca: ENVUELVE.
     *
     * "Hu…" puede ser Hugo o Humberto. Un nombre a medias no es medio nombre: es un nombre
     * equivocado con aspecto de dato.
     */
    private function nombreLarguisimo(): void
    {
        [$company, $calendar] = $this->company('nombre-largo', 'Nombre larguísimo');

        $barra = $this->position($company, 'Barra');
        $quien = $this->hire($company, $calendar, 'Maximiliano', 'Fernández-Etxeberría del Castillo', [$barra]);

        $this->demand($calendar, $barra, '12:00', '20:00', 1);

        for ($d = 1; $d <= 7; $d++) {
            $this->shift($calendar, $quien, $barra, $d, '12:00', '20:00');
        }
    }

    // ── Los ladrillos ────────────────────────────────────────────────────────────────

    /** @return array{0: Company, 1: Calendar} */
    private function company(string $slug, string $nombre): array
    {
        $company = $this->owner->companies()->create([
            'name' => "BT · {$nombre}",
            'timezone' => 'Europe/Madrid',
            'computation_year_start_month' => 1,
            'computation_year_start_day' => 1,
            // Un bar abre los siete días: ningún día es "no laborable".
            'non_working_weekdays' => [],
        ]);

        $calendar = $company->calendars()->create([
            'name' => 'Cuadrante',
            'starts_on' => $this->monday->subMonths(6)->toDateString(),
            'ends_on' => null,
            'is_active' => true,
        ]);

        $this->index[] = [
            'slug' => $slug,
            'nombre' => $nombre,
            'url' => "/companies/{$company->id}/calendars/{$calendar->id}/schedule?week={$this->monday->toDateString()}",
        ];

        return [$company, $calendar];
    }

    private function position(Company $company, string $name): Position
    {
        return $company->positions()->create(['name' => $name, 'is_active' => true]);
    }

    /**
     * Contrata a alguien con un perfil HOLGADO, para que no salte ninguna regla que el
     * escenario no haya pedido.
     *
     * Un escenario que quiere probar "huecos SIN violaciones" no puede traer de propina un
     * incumplimiento de tope semanal: entonces no probaría lo que dice probar.
     *
     * @param  array<int, Position>  $positions
     */
    private function hire(Company $company, Calendar $calendar, string $first, string $last, array $positions, array $overrides = []): Employment
    {
        $profile = $company->profiles()->create([
            // Un perfil por persona: los perfiles son únicos por (empresa, nombre), y en un
            // escenario con dos contrataciones dos "Holgado" chocarían.
            'name' => "Holgado · {$first}",
            // Sin tope semanal: los escenarios colocan siete turnos de 8 h (56 h) y no
            // quiero que salte el tope en un caso que va de otra cosa.
            'max_minutes_week' => null,
            'max_minutes_per_shift' => 10 * 60,
            'min_rest_minutes_between_shifts' => 8 * 60,
            'annual_leave_days' => 22,
            'workday_type' => WorkdayType::Any,
            ...$overrides,
        ]);

        $person = $this->owner->people()->create(['first_name' => $first, 'last_name' => $last]);

        $employment = $company->employments()->create([
            'person_id' => $person->id,
            'profile_id' => $profile->id,
            'starts_on' => $this->monday->subYear()->toDateString(),
            'ends_on' => null,
        ]);

        $employment->positions()->attach(collect($positions)->pluck('id')->all());
        $employment->calendars()->attach($calendar);

        return $employment;
    }

    /** @param  array<int, int>  $days  Los días ISO en que se pide. Por defecto, todos. */
    private function demand(Calendar $calendar, Position $position, string $start, string $end, int $count, array $days = [1, 2, 3, 4, 5, 6, 7]): void
    {
        foreach ($days as $day) {
            $calendar->coverageRequirements()->create([
                'position_id' => $position->id,
                'effective_from' => $this->monday->subMonths(6)->toDateString(),
                'recurrence' => Recurrence::Weekly,
                'day_of_week' => $day,
                'starts_at' => $start,
                'ends_at' => $end,
                'required_count' => $count,
            ]);
        }
    }

    /** $isoDay 1 = lunes … 7 = domingo. 0 = el domingo ANTERIOR (fuera de la semana visible). */
    private function shift(Calendar $calendar, Employment $employment, Position $position, int $isoDay, string $start, string $end): void
    {
        $company = $employment->company;
        $workDate = $this->monday->addDays($isoDay - 1);

        $startsAt = $company->toUtc($workDate->toDateString(), $start);

        $endsAt = $end === '24:00'
            ? $company->toUtc($workDate->addDay()->toDateString(), '00:00')
            : $company->toUtc($workDate->toDateString(), $end);

        // Si acaba antes de empezar, cruza medianoche. No es un caso especial: es un nocturno.
        if ($endsAt->lte($startsAt)) {
            $endsAt = $company->toUtc($workDate->addDay()->toDateString(), $end);
        }

        $calendar->assignments()->create([
            'employment_id' => $employment->id,
            'position_id' => $position->id,
            'work_date' => $workDate->toDateString(),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ]);
    }
}
