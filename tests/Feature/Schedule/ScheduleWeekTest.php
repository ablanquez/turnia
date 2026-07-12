<?php

namespace Tests\Feature\Schedule;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\Concerns\RequestsDeferredProps;
use Tests\TestCase;

class ScheduleWeekTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;
    use RequestsDeferredProps;

    private function world(): array
    {
        $owner = $this->makeUser();
        $company = $this->makeCompany($owner, ['name' => "L'Òptim"]);
        $calendar = $this->makeCalendar($company);
        $barra = $this->makePosition($company, 'Barra');

        $lucia = $this->makePerson($owner);
        $lucia->update(['first_name' => 'Lucía', 'last_name' => 'Díaz']);

        $employment = $this->makeEmployment($company, $lucia, $this->makeProfile($company));
        $employment->positions()->attach($barra);
        $employment->calendars()->attach($calendar);

        // JORNADA PARTIDA: dos turnos el mismo día, con un agujero real en medio.
        $this->assign($employment, $barra, '2026-07-06', '09:00', '13:00', calendar: $calendar);
        $this->assign($employment, $barra, '2026-07-06', '17:00', '21:00', calendar: $calendar);

        // NOCTURNO: cruza medianoche.
        $this->assign($employment, $barra, '2026-07-07', '22:00', '06:00', '2026-07-08', $calendar);

        return compact('owner', 'company', 'calendar', 'employment', 'lucia');
    }

    private function url(array $world, string $week = '2026-07-06'): string
    {
        return "/companies/{$world['company']->id}/calendars/{$world['calendar']->id}/schedule?week={$week}";
    }

    #[Test]
    public function la_parrilla_de_la_semana_se_pinta(): void
    {
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Schedule/Week')
                ->where('window.from', '2026-07-06')
                ->where('window.to', '2026-07-12')
                ->where('window.isoWeek', 28)
                ->has('window.days', 7)
                ->has('assignments', 3)
                ->has('positions', 1)
                ->has('people', 1)
            );
    }

    #[Test]
    public function la_jornada_partida_son_dos_barras_con_un_agujero_de_verdad(): void
    {
        // El modelo no tiene un campo "es partida": lo es de facto. Y en la parrilla se
        // VE, porque las dos barras están donde tocan y entre ellas no hay nada.
        $world = $this->world();

        $props = $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->viewData('page')['props'];

        $delLunes = collect($props['assignments'])
            ->where('workDate', '2026-07-06')
            ->sortBy('startHour')
            ->values();

        $this->assertCount(2, $delLunes);
        $this->assertSame(9.0, $delLunes[0]['startHour']);
        $this->assertSame(13.0, $delLunes[0]['endHour']);
        $this->assertSame(17.0, $delLunes[1]['startHour']);
        $this->assertSame(21.0, $delLunes[1]['endHour']);

        // El agujero: la primera acaba a las 13 y la segunda empieza a las 17.
        $this->assertGreaterThan($delLunes[0]['endHour'], $delLunes[1]['startHour']);
    }

    #[Test]
    public function el_turno_nocturno_se_pinta_cruzando_el_borde_del_dia(): void
    {
        $world = $this->world();

        $props = $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->viewData('page')['props'];

        $nocturno = collect($props['assignments'])->firstWhere('workDate', '2026-07-07');

        $this->assertSame(22.0, $nocturno['startHour']);
        $this->assertSame(30.0, $nocturno['endHour'], 'Sale a las 06:00 del día siguiente: hora 30 del eje.');
        $this->assertTrue($nocturno['crossesMidnight']);
        $this->assertSame('22:00–06:00', $nocturno['label']);
    }

    #[Test]
    public function el_informe_de_incumplimientos_no_viaja_en_la_carga(): void
    {
        /*
         * LA DECISIÓN MÁS IMPORTANTE DE LA VISTA, PROBADA.
         *
         * Si un día alguien "simplifica" el controlador y quita el Inertia::defer(),
         * la parrilla seguiría funcionando —y por eso nadie lo notaría en una revisión—
         * pero tardaría un segundo en aparecer. Este test lo impide.
         */
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page->missing('violations'));
    }

    #[Test]
    public function los_incumplimientos_llegan_cuando_se_piden(): void
    {
        // Y la contraprueba: diferido no es "nunca". Al pedirlos, están.
        $world = $this->world();

        $response = $this->getDeferred($world['owner'], $this->url($world), 'Schedule/Week', 'violations');

        $response->assertOk();
        $this->assertIsArray($response->json('props.violations.assignments'));
    }

    #[Test]
    public function se_puede_navegar_a_otra_semana(): void
    {
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get($this->url($world, '2026-07-13'))
            ->assertInertia(fn (Assert $page) => $page
                ->where('window.from', '2026-07-13')
                ->has('assignments', 0)
            );
    }

    #[Test]
    public function una_semana_ilegible_no_revienta_la_parrilla(): void
    {
        // ?week=patata. Cae a la semana de hoy en vez de a un 500: un parámetro de la
        // barra de direcciones no puede tumbar el cuadrante.
        $world = $this->world();

        $this->actingAs($world['owner'])
            ->get("/companies/{$world['company']->id}/calendars/{$world['calendar']->id}/schedule?week=patata")
            ->assertOk();
    }

    #[Test]
    public function un_calendario_de_otra_empresa_no_se_cuela_por_la_url(): void
    {
        // La ruta lleva empresa Y calendario. Sin esta comprobación, cambiar el id de la
        // empresa en la barra de direcciones dejaría pasar el calendario de otro.
        $world = $this->world();
        $otra = $this->makeCompany($world['owner'], ['name' => 'Otro bar']);

        $this->actingAs($world['owner'])
            ->get("/companies/{$otra->id}/calendars/{$world['calendar']->id}/schedule")
            ->assertNotFound();
    }

    #[Test]
    public function el_dashboard_solo_ensena_las_empresas_a_las_que_se_tiene_acceso(): void
    {
        $world = $this->world();
        $extrano = User::create([
            'name' => 'Nadie',
            'email' => 'nadie@turnia.test',
            'password' => 'secret',
        ]);

        $this->actingAs($extrano)
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page->has('companies', 0));

        $this->actingAs($world['owner'])
            ->get('/dashboard')
            ->assertInertia(fn (Assert $page) => $page
                ->has('companies', 1)
                ->where('companies.0.role', 'Empresario')
            );
    }
}
