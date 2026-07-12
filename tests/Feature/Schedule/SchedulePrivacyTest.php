<?php

namespace Tests\Feature\Schedule;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * QUÉ PORCIÓN DE LOS DATOS VE CADA UNO.
 *
 * Turnia guarda bajas médicas. Que un empleado no vea la baja de su compañera no es
 * una preferencia de producto: es lo que separa una herramienta de un problema.
 *
 * Estos tests NO comprueban que la policy devuelva true o false. Comprueban que el
 * DATO NO SALE POR EL CABLE. Una policy correcta y una consulta que se olvida de
 * aplicarla producen exactamente la misma fuga.
 */
class SchedulePrivacyTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function world(): array
    {
        $owner = $this->makeUser();
        $company = $this->makeCompany($owner, ['name' => "L'Òptim"]);
        $calendar = $this->makeCalendar($company);
        $position = $this->makePosition($company, 'Barra');

        $ana = $this->makePerson($owner);
        $ana->update(['first_name' => 'Ana', 'last_name' => 'López']);

        $sara = $this->makePerson($owner);
        $sara->update(['first_name' => 'Sara', 'last_name' => 'Gil']);

        $anaEmp = $this->makeEmployment($company, $ana);
        $saraEmp = $this->makeEmployment($company, $sara);

        foreach ([$anaEmp, $saraEmp] as $employment) {
            $employment->positions()->attach($position);
            $employment->calendars()->attach($calendar);
        }

        $this->assign($anaEmp, $position, '2026-07-06', '09:00', '17:00', calendar: $calendar);
        $this->assign($saraEmp, $position, '2026-07-07', '09:00', '17:00', calendar: $calendar);

        // El dato caliente: la baja de SARA y su hora médica.
        $baja = $this->makeAbsenceType($company, AbsenceScope::Person, Computation::Blocks, 'Baja médica');
        $this->addAbsence($sara, $baja, '2026-07-08', '2026-07-10');

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');
        $this->addConcept($saraEmp, $medica, '2026-07-07', '10:00', '11:00');

        // El login de Ana: es EMPLEADA porque apunta a su persona, y por nada más.
        // linkTo(), no create(): person_id no es fillable, y con razón.
        $anaUser = User::create([
            'name' => 'Ana López',
            'email' => 'ana@turnia.test',
            'password' => 'secret',
        ])->linkTo($ana);

        $manager = User::create([
            'name' => 'Encargado',
            'email' => 'encargado@turnia.test',
            'password' => 'secret',
        ]);
        $company->managers()->attach($manager);

        return compact('owner', 'company', 'calendar', 'anaUser', 'manager', 'ana', 'sara');
    }

    private function url(array $world): string
    {
        return "/companies/{$world['company']->id}/calendars/{$world['calendar']->id}/schedule?week=2026-07-06";
    }

    #[Test]
    public function un_empleado_no_ve_la_baja_medica_de_su_companera(): void
    {
        $world = $this->world();

        $this->actingAs($world['anaUser'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page
                ->component('Schedule/Week')
                // Ni una sola ausencia: la única que hay en la ventana es la de Sara.
                ->has('absences', 0)
            );
    }

    #[Test]
    public function un_empleado_no_ve_los_conceptos_horarios_de_su_companera(): void
    {
        $world = $this->world();

        $this->actingAs($world['anaUser'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page->has('conceptEntries', 0));
    }

    #[Test]
    public function un_empleado_si_ve_el_cuadrante_entero_de_turnos(): void
    {
        // El cuadrante se cuelga en la pared del bar: quién está de barra el sábado NO
        // es un secreto. Lo que es un secreto es POR QUÉ alguien falta.
        $world = $this->world();

        $this->actingAs($world['anaUser'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page->has('assignments', 2));
    }

    #[Test]
    public function un_empleado_no_ve_el_panel_de_plantilla(): void
    {
        // Lleva contadores de horas. "Sara lleva 41 de 40" es una conversación entre
        // Sara y su encargado, no un anuncio.
        $world = $this->world();

        $this->actingAs($world['anaUser'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page
                ->has('staff', 0)
                ->where('can.seeStaff', false)
            );
    }

    #[Test]
    public function el_encargado_si_ve_las_ausencias_y_los_conceptos_de_toda_la_plantilla(): void
    {
        // La contraprueba: si el encargado tampoco los viera, el test anterior estaría
        // pasando por una consulta rota, no por la policy.
        $world = $this->world();

        $this->actingAs($world['manager'])
            ->get($this->url($world))
            ->assertInertia(fn (Assert $page) => $page
                ->has('absences', 1)
                ->has('conceptEntries', 1)
                ->has('staff', 2)
                ->where('can.seeStaff', true)
            );
    }

    #[Test]
    public function un_extrano_no_entra(): void
    {
        // FAIL-CLOSED: estar autenticado en Turnia no da acceso a ninguna empresa.
        $world = $this->world();
        $extrano = $this->makeUser();

        $this->actingAs($extrano)
            ->get($this->url($world))
            ->assertForbidden();
    }

    #[Test]
    public function sin_sesion_no_hay_parrilla(): void
    {
        $world = $this->world();

        $this->get($this->url($world))->assertRedirect('/login');
    }

    #[Test]
    public function nadie_puede_declararse_empleado_por_asignacion_masiva(): void
    {
        /*
         * EL FAIL-CLOSED, FIJADO.
         *
         * person_id es el campo que decide DE QUIÉN son los datos que ves. Si algún día
         * alguien lo mete en $fillable "porque es más cómodo para el seeder", bastaría
         * con colar un person_id en un formulario para leer las bajas médicas de otro.
         *
         * Este test es el que impide ese día. Y no es teórico: al escribir el seeder yo
         * mismo intenté pasarlo por create(), Eloquent lo descartó en silencio, y el
         * login quedó sin ser de nadie.
         */
        $world = $this->world();

        $intruso = User::create([
            'name' => 'Intruso',
            'email' => 'intruso@turnia.test',
            'password' => 'secret',
            'person_id' => $world['sara']->id,
        ]);

        $this->assertNull($intruso->fresh()->person_id, 'person_id NO puede llegar por asignación masiva.');

        $this->actingAs($intruso)
            ->get($this->url($world))
            ->assertForbidden();
    }
}
