<?php

namespace Tests\Feature\Schedule;

use App\Enums\Recurrence;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL ZOOM DÍA.
 *
 * No añade motor: le da al mismo motor una ventana de un día y sitio para pintarla. Es la
 * vista donde la COBERTURA POR SEGMENTOS por fin se lee, que es una capacidad que costó
 * una tanda entera y que en la semana cabe apretada.
 */
class ScheduleDayTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function world(): array
    {
        $owner = $this->makeUser();
        $company = $this->makeCompany($owner, ['name' => "L'Òptim"]);
        $calendar = $this->makeCalendar($company);
        $barra = $this->makePosition($company, 'Barra');

        // Tope SEMANAL de 40 h.
        $profile = $this->makeProfile($company, ['max_minutes_week' => 40 * 60]);

        $sara = $this->makePerson($owner);
        $sara->update(['first_name' => 'Sara', 'last_name' => 'Gil']);

        $employment = $this->makeEmployment($company, $sara, $profile);
        $employment->positions()->attach($barra);
        $employment->calendars()->attach($calendar);

        // 6 turnos de 7 h = 42 h: se pasa del tope semanal.
        foreach (['06', '07', '08', '09', '10', '11'] as $dia) {
            $this->assign($employment, $barra, "2026-07-{$dia}", '12:00', '19:00', calendar: $calendar);
        }

        // Y hacen falta 3 de barra de 12 a 16: con una sola persona, faltan 2.
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 3);

        return compact('owner', 'company', 'calendar');
    }

    private function url(array $world, string $day = '2026-07-06'): string
    {
        return "/companies/{$world['company']->id}/calendars/{$world['calendar']->id}/schedule/day?day={$day}";
    }

    #[Test]
    public function la_vista_dia_se_pinta_con_un_solo_dia_en_la_ventana(): void
    {
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Schedule/Day')
                ->where('granularity', 'day')
                ->where('window.from', '2026-07-06')
                ->where('window.to', '2026-07-06')
                ->has('window.days', 1)
                ->has('assignments', 1)
            );
    }

    #[Test]
    public function el_hueco_de_cobertura_llega_con_su_anchura_real_sobre_el_eje(): void
    {
        // LA RAZÓN DE QUE ESTA VISTA EXISTA. El motor no dice "falta gente por la tarde":
        // dice "de 12 a 16 faltan 2", y el hueco se pinta EXACTAMENTE ahí.
        $world = $this->world();

        $props = $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->viewData('page')['props'];

        $hueco = collect($props['coverage']['segments'])->firstWhere('missing', 2);

        $this->assertNotNull($hueco, 'Se pedían 3 de barra de 12 a 16 y solo hay 1.');
        $this->assertSame('12:00–16:00', $hueco['label']);

        // El eje va de 6 a 30: las 12:00 caen en el 25% y el tramo dura 4 de 24 horas.
        $this->assertEqualsWithDelta(25.0, $hueco['left'], 0.01);
        $this->assertEqualsWithDelta(100 * 4 / 24, $hueco['width'], 0.01);
    }

    #[Test]
    public function el_contador_de_la_plantilla_es_el_de_la_semana_aunque_se_mire_un_dia(): void
    {
        /*
         * ⚠️ ESTO ESTUVO MAL, Y SE VIO MIRANDO LA PANTALLA.
         *
         * El tope del perfil es SEMANAL. En la vista Día se estaban contando las horas del
         * DÍA contra ese tope, así que Sara salía como "7 de 40 h" —holgadísima— cuando en
         * realidad lleva 42 de 40 y está incumpliendo.
         *
         * Es un silencio falso, y en el peor sitio: el panel es justo donde el encargado
         * decide a quién puede cargarle otro turno.
         *
         * La regla: el numerador y el denominador tienen que estar en la misma unidad.
         */
        $world = $this->world();

        $props = $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->viewData('page')['props'];

        $sara = $props['staff'][0];

        $this->assertSame(42 * 60, $sara['workedMinutes'], 'Las horas de la SEMANA, no las del día.');
        $this->assertSame(40 * 60, $sara['limitMinutes']);
        $this->assertTrue($sara['overLimit'], 'Y por tanto se ve que se pasa.');
    }

    #[Test]
    public function el_tramo_correcto_llega_en_verde_y_el_incubrible_no_llega_en_rojo(): void
    {
        /*
         * LOS CUATRO ESTADOS DE LA TIRA, PROBADOS EN EL CABLE.
         *
         * El "covered" faltaba entero: el motor tiraba los tramos correctos y la parrilla no
         * podía pintar verde. Sin verde, el gris significaba a la vez "cubierto" y "aquí no
         * se pide nada" — dos cosas opuestas, el mismo color.
         *
         * Y el "uncoverable" salía ROJO, como un hueco normal. El rojo dice "ponle a
         * alguien", y aquí no hay a quién poner: deshacía el aviso que el motor daba.
         *
         * ⚠️ Este test también existe porque la clausura que marca el incubrible NUNCA se
         * ejecutaba en los tests (sin conflictos de catálogo, no se entra en ella), y un
         * `use` que faltaba solo reventó al abrir la página con datos de verdad.
         */
        $world = $this->world();
        $company = $world['company'];
        $calendar = $world['calendar'];

        // Un puesto que NADIE puede cubrir.
        $sumiller = $this->makePosition($company, 'Sumiller');
        $this->makeRequirement($calendar, $sumiller, Recurrence::Daily, '20:00', '23:00', 1);

        // Y un puesto donde la cobertura queda EXACTA.
        $cocina = $this->makePosition($company, 'Cocina');
        $nuria = $this->makePerson($world['owner']);
        $empleo = $this->makeEmployment($company, $nuria);
        $empleo->positions()->attach($cocina);
        $empleo->calendars()->attach($calendar);
        $this->assign($empleo, $cocina, '2026-07-06', '12:00', '16:00', calendar: $calendar);
        $this->makeRequirement($calendar, $cocina, Recurrence::Daily, '12:00', '16:00', 1);

        $props = $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->viewData('page')['props'];

        $estados = collect($props['coverage']['segments'])->pluck('state')->unique();

        $this->assertContains('covered', $estados, 'El tramo correcto no llega: sin él no hay verde.');
        $this->assertContains('missing', $estados);
        $this->assertContains('uncoverable', $estados, 'El puesto incubrible sale como un hueco normal.');

        // Y el incubrible NO se marca como hueco corriente.
        $incubrible = collect($props['coverage']['segments'])->firstWhere('state', 'uncoverable');
        $this->assertSame($sumiller->id, $incubrible['positionId']);
    }

    #[Test]
    public function el_informe_tampoco_viaja_en_la_carga_del_dia(): void
    {
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page->missing('violations'));
    }

    #[Test]
    public function un_extrano_tampoco_entra_por_la_puerta_del_dia(): void
    {
        // La ruta nueva es una puerta nueva: si se autoriza en una y no en la otra, la
        // policy no sirve de nada.
        $world = $this->world();

        $this->actingAs($this->makeUser())
            ->get($this->url($world))
            ->assertForbidden();
    }
}
