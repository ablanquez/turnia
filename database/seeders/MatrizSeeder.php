<?php

namespace Database\Seeders;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
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
 * EL PRODUCTO CARTESIANO DE LA MATRIZ VISUAL, SEMBRADO DE VERDAD EN LA BASE DE VERDAD.
 *
 * ⚠️ LEE docs/MATRIZ-VISUAL.md. Este seeder monta los casos; ese documento dice cómo se pintan.
 *
 * No se enumeran los casos "que se me ocurren": se generan TODAS las combinaciones de las
 * dimensiones y se siembran una a una, cada una en SU PROPIA CELDA, con SU PROPIA persona.
 *
 * ⚠️ Y LA CLAVE DE UN CASO ES LO QUE EL MOTOR DICE QUE SALIÓ, NO LO QUE YO PRETENDÍA SEMBRAR.
 *
 * Aquí se giran tres mandos independientes (sin perfil · no cualificado · ausente) con la
 * INTENCIÓN de producir cada subconjunto de gravedades. Pero quien decide qué reglas se rompen
 * es el motor, no yo. Si un caso no sale como esperaba, el instrumento NO lo fuerza: lee lo que
 * el motor informa, comprueba que el pintado corresponde a ESO, y el informe dice honestamente
 * qué combinaciones se alcanzaron y cuáles no son construibles. Un test que fabrica su propia
 * verdad no prueba nada.
 *
 * CADA PERSONA EN SU CELDA Y CON SU PROPIO CONTRATO: si compartieran, el tope semanal de una
 * arrastraría a la de al lado y el caso "turno limpio" saldría con un incumplimiento que nadie
 * ha pedido.
 *
 *   php artisan db:seed --class=MatrizSeeder
 *   node tests/Visual/matriz.mjs
 */
class MatrizSeeder extends Seeder
{
    private CarbonImmutable $monday;

    private User $owner;

    /** @var array<string, mixed> */
    private array $index = [];

    public function run(): void
    {
        // Una semana FIJA y futura: un caso no puede cambiar de resultado según el día que se corra.
        $this->monday = CarbonImmutable::parse('2026-09-07');

        $this->owner = User::query()->firstWhere('email', 'demo@turnia.test')
            ?? User::factory()->create(['email' => 'demo@turnia.test']);

        $this->index = [
            'monday' => $this->monday->toDateString(),
            'bloques' => $this->bloques(),
            'tira' => $this->tira(),
            'bandas' => $this->bandas(),
            'celdas' => $this->celdas(),
        ];

        file_put_contents(
            base_path('tests/Visual/matriz.json'),
            json_encode($this->index, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        );
    }

    /**
     * CAPA 1: LOS BLOQUES. El producto cartesiano completo, celda a celda.
     *
     *   TURNOS   = 8 gravedades × 2 forzado × 2 nocturno        = 32
     *   CONCEPTOS = 4 cómputos × 8 gravedades × 2 nocturno      = 64
     *
     * Las tres perillas de gravedad son INDEPENDIENTES, y por eso dan los 8 subconjuntos:
     *
     *   · sin perfil        → notice     (el contrato no tiene condiciones definidas)
     *   · no cualificado    → breach     (no está cualificado para ese puesto)
     *   · ausente ese día   → impossible (no puede estar: hay una baja encima)
     *
     * Un concepto no puede ser "no cualificado" —no cuelga de un puesto— así que su breach se
     * busca por otro lado: un tope semanal minúsculo, que el concepto que SUMA tiempo revienta.
     * Los que no suman tiempo no lo revientan, y eso NO es un fallo del test: es que esa
     * combinación no existe. El informe lo dice.
     */
    private function bloques(): array
    {
        [$company, $calendar] = $this->company('matriz-bloques', 'Matriz · bloques');

        $casos = [];

        foreach ([false, true] as $sinPerfil) {
            foreach ([false, true] as $noCualificado) {
                foreach ([false, true] as $ausente) {
                    foreach ([false, true] as $forzado) {
                        foreach ([false, true] as $nocturno) {
                            $casos[] = [
                                'kind' => 'shift',
                                'computation' => null,
                                'sinPerfil' => $sinPerfil,
                                'noCualificado' => $noCualificado,
                                'ausente' => $ausente,
                                'forzado' => $forzado,
                                'nocturno' => $nocturno,
                            ];
                        }
                    }
                }
            }
        }

        foreach (Computation::cases() as $computation) {
            foreach ([false, true] as $sinPerfil) {
                foreach ([false, true] as $topeMinusculo) {
                    foreach ([false, true] as $ausente) {
                        foreach ([false, true] as $nocturno) {
                            $casos[] = [
                                'kind' => 'concept',
                                'computation' => $computation->value,
                                'sinPerfil' => $sinPerfil,
                                'topeMinusculo' => $topeMinusculo,
                                'noCualificado' => false,
                                'ausente' => $ausente,
                                'forzado' => false,
                                'nocturno' => $nocturno,
                            ];
                        }
                    }
                }
            }
        }

        // Un puesto por cada 7 casos: cada caso vive SOLO en su celda, así el instrumento la
        // localiza por (puesto, día) y jamás compara la barra de un caso con la de su vecino.
        $puestos = [];
        for ($i = 0; $i < (int) ceil(count($casos) / 7); $i++) {
            $puestos[] = $this->position($company, 'P'.str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT));
        }

        // Un puesto AJENO al que nadie está cualificado: es donde se coloca al "no cualificado".
        $ajeno = $this->position($company, 'Ajeno');

        $conceptTypes = [];
        foreach (Computation::cases() as $c) {
            $conceptTypes[$c->value] = $company->conceptTypes()->create([
                'name' => 'C · '.$c->value,
                'computation' => $c,
                'is_active' => true,
            ]);
        }

        $baja = $company->absenceTypes()->create([
            'name' => 'Baja',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Person,
            'consumes_leave_quota' => false,
            'is_active' => true,
        ]);

        $salida = [];

        foreach ($casos as $i => $caso) {
            $puesto = $puestos[intdiv($i, 7)];
            $dia = ($i % 7) + 1;
            $fecha = $this->monday->addDays($dia - 1);

            // El nombre ES la clave del caso: el instrumento localiza la celda por (puesto, día)
            // y comprueba que dentro está exactamente esta persona. Sin ambigüedad posible.
            $clave = 'K'.str_pad((string) $i, 3, '0', STR_PAD_LEFT);

            $employment = $this->hire(
                $company,
                $calendar,
                $clave,
                'Caso',
                // El "no cualificado" se contrata para OTRO puesto y se le coloca en éste.
                positions: [$caso['noCualificado'] ? $ajeno : $puesto],
                sinPerfil: $caso['sinPerfil'],
                topeMinusculo: $caso['topeMinusculo'] ?? false,
            );

            if ($caso['ausente']) {
                $employment->person->absences()->create([
                    'company_id' => $company->id,
                    'employment_id' => $employment->id,
                    'absence_type_id' => $baja->id,
                    'starts_on' => $fecha->toDateString(),
                    'ends_on' => $fecha->toDateString(),
                ]);
            }

            [$desde, $hasta] = $caso['nocturno'] ? ['22:00', '06:00'] : ['10:00', '18:00'];

            if ($caso['kind'] === 'shift') {
                $assignment = $this->shift($calendar, $employment, $puesto, $fecha, $desde, $hasta);

                if ($caso['forzado']) {
                    // El humano DECIDIÓ colocarlo pese al aviso. No es un error: es una decisión
                    // tomada, y por eso tiene canal propio y no comparte el naranja del que incumple.
                    $assignment->override()->create([
                        'user_id' => $this->owner->id,
                        'reason' => 'Backtest combinatorio',
                        'violations' => [],
                    ]);
                }
            } else {
                $this->concept($employment, $conceptTypes[$caso['computation']], $fecha, $desde, $hasta);
            }

            $salida[] = [
                'clave' => $clave,
                'celda' => "{$puesto->name}|{$fecha->toDateString()}",
                'persona' => "{$clave} Caso",
                'intencion' => $caso,
            ];
        }

        return [
            'url' => $this->url($company, $calendar),
            'casos' => $salida,
        ];
    }

    /**
     * CAPA 2: LA TIRA. Los cinco estados, cada uno en su celda.
     *
     * ⚠️ EL CUARTO Y EL QUINTO SON DE ESTA TANDA, Y EXISTEN PORQUE EL TERCERO MENTÍA.
     *
     * "Sobra 1 sobre una demanda de 2" y "hay 1 donde NO SE PIDE A NADIE" pintaban el mismo
     * "+1" índigo. Y hay dos ceros muy distintos: el que nadie ha declarado (fuera de franja) y
     * el que alguien declaró a propósito (día cerrado), donde poner a alguien SÍ es un exceso —
     * y de los caros: pagas una jornada un día que el negocio no abre.
     */
    private function tira(): array
    {
        [$company, $calendar] = $this->company('matriz-tira', 'Matriz · tira');

        $celdas = [];

        // covered: se piden 2, hay 2.
        $p = $this->position($company, 'Covered');
        $this->demand($calendar, $p, '12:00', '16:00', 2);
        foreach ([1, 2] as $n) {
            $e = $this->hire($company, $calendar, "Cov{$n}", 'Tira', [$p]);
            $this->shift($calendar, $e, $p, $this->monday, '12:00', '16:00');
        }
        $celdas['covered'] = "{$p->name}|{$this->monday->toDateString()}";

        // missing: se piden 2, hay 1.
        $p = $this->position($company, 'Missing');
        $this->demand($calendar, $p, '12:00', '16:00', 2);
        $e = $this->hire($company, $calendar, 'Mis1', 'Tira', [$p]);
        $this->shift($calendar, $e, $p, $this->monday, '12:00', '16:00');
        $celdas['missing'] = "{$p->name}|{$this->monday->toDateString()}";

        // missing + incubrible: se pide 1 y NADIE de la plantilla puede cubrir ese puesto.
        $p = $this->position($company, 'Incubrible');
        $this->demand($calendar, $p, '12:00', '16:00', 1);
        $celdas['missing-uncoverable'] = "{$p->name}|{$this->monday->toDateString()}";

        // excess: se pide 1, hay 2.
        $p = $this->position($company, 'Excess');
        $this->demand($calendar, $p, '12:00', '16:00', 1);
        foreach ([1, 2] as $n) {
            $e = $this->hire($company, $calendar, "Exc{$n}", 'Tira', [$p]);
            $this->shift($calendar, $e, $p, $this->monday, '12:00', '16:00');
        }
        $celdas['excess'] = "{$p->name}|{$this->monday->toDateString()}";

        // unrequested: la demanda va de 12 a 16 y el turno de 10 a 18. Los bordes (10–12 y
        // 16–18) NO tienen demanda de ninguna clase: ahí no sobra nadie, es que no se pide.
        $p = $this->position($company, 'Unrequested');
        $this->demand($calendar, $p, '12:00', '16:00', 1);
        $e = $this->hire($company, $calendar, 'Unr1', 'Tira', [$p]);
        $this->shift($calendar, $e, $p, $this->monday, '10:00', '18:00');
        $celdas['unrequested'] = "{$p->name}|{$this->monday->toDateString()}";

        // cerrado: hay una demanda DECLARADA de cero, y alguien colocado. Eso SÍ es exceso.
        $p = $this->position($company, 'Cerrado');
        $calendar->coverageRequirements()->create([
            'position_id' => $p->id,
            'effective_from' => $this->monday->subMonths(6)->toDateString(),
            'recurrence' => Recurrence::Date,
            'on_date' => $this->monday->toDateString(),
            'starts_at' => '00:00',
            'ends_at' => '23:59',
            'required_count' => 0,
        ]);
        $e = $this->hire($company, $calendar, 'Cer1', 'Tira', [$p]);
        $this->shift($calendar, $e, $p, $this->monday, '12:00', '16:00');
        $celdas['cerrado-con-gente'] = "{$p->name}|{$this->monday->toDateString()}";

        return ['url' => $this->url($company, $calendar), 'celdas' => $celdas];
    }

    /**
     * CAPA 3: LAS BANDAS. bloquea × sin-alta, y sus violaciones.
     *
     * Una ausencia que BLOQUEA la disponibilidad y una que solo se registra se pintaban
     * idénticas. Y una baja SIN ALTA se pintaba igual que una que simplemente continúa la
     * semana que viene. Tres hechos, cero canales.
     */
    private function bandas(): array
    {
        [$company, $calendar] = $this->company('matriz-bandas', 'Matriz · bandas');

        $puesto = $this->position($company, 'Barra');
        $celdas = [];

        foreach ([false, true] as $bloquea) {
            foreach ([false, true] as $abierta) {
                $tipo = $company->absenceTypes()->create([
                    'name' => 'A'.($bloquea ? 'B' : 'N').($abierta ? 'A' : 'C'),
                    'computation' => $bloquea ? Computation::Blocks : Computation::Adds,
                    'scope' => AbsenceScope::Person,
                    'consumes_leave_quota' => false,
                    'is_active' => true,
                ]);

                $clave = ($bloquea ? 'bloquea' : 'no-bloquea').'-'.($abierta ? 'sin-alta' : 'con-alta');
                $e = $this->hire($company, $calendar, $clave, 'Banda', [$puesto]);

                $e->person->absences()->create([
                    'company_id' => $company->id,
                    'employment_id' => $e->id,
                    'absence_type_id' => $tipo->id,
                    'starts_on' => $this->monday->addDays(1)->toDateString(),
                    'ends_on' => $abierta ? null : $this->monday->addDays(3)->toDateString(),
                ]);

                $celdas[$clave] = "{$clave} Banda";
            }
        }

        return ['url' => $this->url($company, $calendar), 'personas' => $celdas];
    }

    /**
     * CAPA 4: LA CELDA. Los carteles, y sobre todo LOS DOS A LA VEZ.
     *
     * ⚠️ Eran `v-if` / `v-else-if`: una celda que era imposible Y sin candidato enseñaba SOLO
     * el imposible. Son dos hechos independientes —uno está en el cuadrante, el otro en el
     * catálogo— y callar uno porque hay otro es esconder un dato.
     */
    private function celdas(): array
    {
        [$company, $calendar] = $this->company('matriz-celdas', 'Matriz · celdas');

        $celdas = [];

        // Solo imposible: alguien se solapa consigo mismo, y hay quien podría cubrir el puesto.
        $p = $this->position($company, 'SoloImposible');
        $e = $this->hire($company, $calendar, 'Solo', 'Imposible', [$p]);
        $this->demand($calendar, $p, '10:00', '20:00', 1);
        $this->shift($calendar, $e, $p, $this->monday, '10:00', '18:00');
        $this->shift($calendar, $e, $p, $this->monday, '14:00', '20:00');
        $celdas['solo-imposible'] = "{$p->name}|{$this->monday->toDateString()}";

        // Solo sin candidato: se pide gente en un puesto para el que nadie está cualificado.
        $p = $this->position($company, 'SoloSinCand');
        $this->demand($calendar, $p, '12:00', '16:00', 1);
        $celdas['solo-sin-candidato'] = "{$p->name}|{$this->monday->toDateString()}";

        /*
         * LAS DOS COSAS A LA VEZ, que es la combinación que nadie había mirado.
         *
         * Se pide gente en un puesto que NADIE de la plantilla puede cubrir (problema de
         * catálogo) y además hay alguien colocado ahí que se solapa consigo mismo (problema de
         * cuadrante). Los dos carteles tienen que verse.
         */
        $p = $this->position($company, 'Ambos');
        $otro = $this->position($company, 'Otro');
        $e = $this->hire($company, $calendar, 'Ambos', 'Celda', [$otro]);
        $this->demand($calendar, $p, '10:00', '20:00', 1);
        $this->shift($calendar, $e, $p, $this->monday, '10:00', '18:00');
        $this->shift($calendar, $e, $p, $this->monday, '14:00', '20:00');
        $celdas['imposible-y-sin-candidato'] = "{$p->name}|{$this->monday->toDateString()}";

        return ['url' => $this->url($company, $calendar), 'celdas' => $celdas];
    }

    // ── Los ladrillos ────────────────────────────────────────────────────────────────

    /** @return array{0: Company, 1: Calendar} */
    private function company(string $slug, string $nombre): array
    {
        $company = $this->owner->companies()->create([
            'name' => "MZ · {$nombre}",
            'timezone' => 'Europe/Madrid',
            'computation_year_start_month' => 1,
            'computation_year_start_day' => 1,
            'non_working_weekdays' => [],
        ]);

        $calendar = $company->calendars()->create([
            'name' => 'Cuadrante',
            'starts_on' => $this->monday->subMonths(6)->toDateString(),
            'ends_on' => null,
            'is_active' => true,
        ]);

        return [$company, $calendar];
    }

    private function url(Company $company, Calendar $calendar): string
    {
        return "/companies/{$company->id}/calendars/{$calendar->id}/schedule?week={$this->monday->toDateString()}";
    }

    private function position(Company $company, string $name): Position
    {
        return $company->positions()->create(['name' => $name, 'is_active' => true]);
    }

    /** @param  array<int, Position>  $positions */
    private function hire(
        Company $company,
        Calendar $calendar,
        string $first,
        string $last,
        array $positions,
        bool $sinPerfil = false,
        bool $topeMinusculo = false,
    ): Employment {
        $profile = $sinPerfil ? null : $company->profiles()->create([
            'name' => "Perfil · {$first} {$last}",
            'max_minutes_week' => null,
            /*
             * ⚠️ EL ÚNICO INCUMPLIMIENTO QUE PUEDE ROMPER UN CONCEPTO ES ÉSTE.
             *
             * Un concepto no cuelga de ningún puesto, así que no puede estar "no cualificado".
             * Y de las cinco reglas que se le aplican (Availability, ContractActive,
             * IntervalSanity, Overlap, OvertimeLimit), las cuatro primeras son IMPOSIBLES: la
             * única que da `breach` es el tope de horas extra.
             *
             * Empecé apretando `max_minutes_week` —el tope semanal— y no saltaba nunca. No era
             * un fallo del seeder: es que ese tope no se le aplica a un concepto. El caso
             * "concepto que incumple" solo existe para los de CONTADOR APARTE, y solo por aquí.
             */
            'max_overtime_minutes_year' => $topeMinusculo ? 60 : null,
            'max_minutes_per_shift' => 24 * 60,
            'min_rest_minutes_between_shifts' => 0,
            'annual_leave_days' => 22,
            'workday_type' => WorkdayType::Any,
        ]);

        $person = $this->owner->people()->create(['first_name' => $first, 'last_name' => $last]);

        $employment = $company->employments()->create([
            'person_id' => $person->id,
            'profile_id' => $profile?->id,
            'starts_on' => $this->monday->subYear()->toDateString(),
            'ends_on' => null,
        ]);

        $employment->positions()->attach(collect($positions)->pluck('id')->all());
        $employment->calendars()->attach($calendar);

        return $employment;
    }

    /** @param  array<int, int>  $days */
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

    private function shift(Calendar $calendar, Employment $employment, Position $position, CarbonImmutable $workDate, string $start, string $end)
    {
        $company = $employment->company;

        $startsAt = $company->toUtc($workDate->toDateString(), $start);
        $endsAt = $company->toUtc($workDate->toDateString(), $end);

        // Si acaba antes de empezar, cruza medianoche. No es un caso especial: es un nocturno.
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

    private function concept(Employment $employment, $type, CarbonImmutable $workDate, string $start, string $end): void
    {
        $company = $employment->company;

        $startsAt = $company->toUtc($workDate->toDateString(), $start);
        $endsAt = $company->toUtc($workDate->toDateString(), $end);

        if ($endsAt->lte($startsAt)) {
            $endsAt = $company->toUtc($workDate->addDay()->toDateString(), $end);
        }

        $employment->conceptEntries()->create([
            'concept_type_id' => $type->id,
            'work_date' => $workDate->toDateString(),
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
        ]);
    }
}
