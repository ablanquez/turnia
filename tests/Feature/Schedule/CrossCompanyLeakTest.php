<?php

namespace Tests\Feature\Schedule;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\Concerns\RequestsDeferredProps;
use Tests\TestCase;

/**
 * EL DATO DE LA OTRA EMPRESA NO SE FILTRA.
 *
 * Marco trabaja en el Bar A y en el Bar B, los dos del mismo dueño. El encargado del
 * Bar A tiene que ENTERARSE de que Marco está comprometido en otro sitio ese día (o le
 * dará una jornada que no puede cumplir), pero no le corresponde saber DÓNDE ni A QUÉ
 * HORA.
 *
 * ⚠️ Y esto no se prueba mirando la policy: se prueba BUSCANDO EL NOMBRE DEL OTRO BAR
 * EN LA RESPUESTA. Una policy correcta y un mensaje que ya traía el nombre incrustado
 * producen exactamente la misma fuga, y el motor SÍ trae el nombre incrustado: es su
 * trabajo saberlo. Por eso el aviso se redacta al salir, y por eso el test husmea el
 * cable en vez de creerse la intención.
 */
class CrossCompanyLeakTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;
    use RequestsDeferredProps;

    private const OTRO_BAR = 'Bar Central';

    private function world(): array
    {
        $owner = $this->makeUser();

        $optim = $this->makeCompany($owner, ['name' => "L'Òptim"]);
        $central = $this->makeCompany($owner, ['name' => self::OTRO_BAR]);

        $calendar = $this->makeCalendar($optim);
        $barra = $this->makePosition($optim, 'Barra');

        $marco = $this->makePerson($owner);
        $marco->update(['first_name' => 'Marco', 'last_name' => 'Ruiz']);

        $enOptim = $this->makeEmployment($optim, $marco);
        $enOptim->positions()->attach($barra);
        $enOptim->calendars()->attach($calendar);

        // El turno que se ve en la parrilla de L'Òptim.
        $this->assign($enOptim, $barra, '2026-07-06', '16:00', '20:00', calendar: $calendar);

        // Y el de la OTRA empresa, el mismo día, que no se solapa y que por tanto solo
        // dispara el aviso de jornada compartida.
        $barraCentral = $this->makePosition($central, 'Barra');
        $enCentral = $this->makeEmployment($central, $marco);
        $enCentral->positions()->attach($barraCentral);
        $this->assign($enCentral, $barraCentral, '2026-07-06', '08:00', '12:00');

        $manager = User::create([
            'name' => 'Encargado de L\'Òptim',
            'email' => 'encargado@turnia.test',
            'password' => 'secret',
        ]);
        $optim->managers()->attach($manager);

        return compact('owner', 'optim', 'calendar', 'manager');
    }

    private function url(array $world): string
    {
        return "/companies/{$world['optim']->id}/calendars/{$world['calendar']->id}/schedule?week=2026-07-06";
    }

    /** La prop de incumplimientos va DIFERIDA: hay que pedirla aparte, como hace Inertia. */
    private function violationsFor(User $user, array $world): array
    {
        $response = $this->getDeferred($user, $this->url($world), 'Schedule/Week', 'violations');

        $response->assertOk();

        return $response->json('props.violations');
    }

    #[Test]
    public function el_encargado_recibe_el_aviso_pero_no_el_nombre_del_otro_bar(): void
    {
        $world = $this->world();

        $violations = $this->violationsFor($world['manager'], $world);
        $avisos = collect($violations['assignments'])->flatten(1);

        // EL AVISO LLEGA. Silenciarlo sería peor que filtrar el nombre: el encargado
        // encadenaría dos jornadas sin saberlo.
        $this->assertTrue(
            $avisos->contains(fn ($v) => $v['code'] === 'shared_workday'),
            'El encargado tiene que enterarse de que Marco trabaja hoy en otro sitio.',
        );

        // Y NO LLEVA EL DATO AJENO. Se busca en TODA la respuesta, no solo en el aviso:
        // el nombre podría colarse por el contexto, por un id o por un turno que no
        // debería estar ahí.
        $crudo = json_encode($violations, JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString(
            self::OTRO_BAR,
            $crudo,
            'FUGA: el encargado del Bar A está viendo el nombre del Bar B.',
        );

        $compartido = $avisos->firstWhere('code', 'shared_workday');

        $this->assertSame('Ese día también trabaja en otra empresa.', $compartido['message']);
        $this->assertSame([], $compartido['context'], 'El contexto llevaba los ids de los turnos ajenos.');
    }

    #[Test]
    public function el_dueno_si_ve_el_nombre_porque_los_dos_bares_son_suyos(): void
    {
        // LA CONTRAPRUEBA. Sin esto, el test anterior pasaría igual si el aviso no se
        // emitiera nunca, o si el motor hubiera dejado de saber el nombre — que es
        // justo lo que NO queríamos hacerle al motor.
        $world = $this->world();

        $violations = $this->violationsFor($world['owner'], $world);
        $avisos = collect($violations['assignments'])->flatten(1);

        $compartido = $avisos->firstWhere('code', 'shared_workday');

        $this->assertNotNull($compartido);
        $this->assertStringContainsString(self::OTRO_BAR, $compartido['message']);

        // Y con la hora en el reloj del OTRO bar, no en UTC.
        $this->assertStringContainsString('08:00-12:00', $compartido['message']);
    }

    #[Test]
    public function el_encargado_no_ve_los_turnos_de_la_otra_empresa_en_la_parrilla(): void
    {
        $world = $this->world();

        $response = $this->actingAs($world['manager'])->get($this->url($world));

        // Solo el turno de L'Òptim. El del Bar Central existe, ocupa a Marco y el motor
        // lo tiene en cuenta... pero no se pinta aquí, porque no es de esta empresa.
        $assignments = $response->viewData('page')['props']['assignments'];

        $this->assertCount(1, $assignments);
        $this->assertSame('16:00–20:00', $assignments[0]['label']);
    }
}
