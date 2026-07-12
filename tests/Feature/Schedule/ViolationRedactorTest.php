<?php

namespace Tests\Feature\Schedule;

use App\Enums\RuleCode;
use App\Services\Scheduling\Presentation\ScheduleScope;
use App\Services\Scheduling\Presentation\ViolationRedactor;
use App\Services\Scheduling\Validation\ValidationResult;
use App\Services\Scheduling\Validation\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * LA OTRA MITAD DE "EL MENSAJE TIENE QUE DECIR LA VERDAD": también puede decir de MÁS.
 *
 * En MessageTruthTest se comprueba que el mensaje no MIENTE. Aquí, que no FILTRA.
 *
 * El motor SABE el nombre del otro bar y hace bien en saberlo: es su trabajo. Quien
 * decide qué se enseña es la capa que conoce a quien mira, y esa es esta. Mutilar la
 * regla "por privacidad" metería un silencio falso en el sitio más caro de todos, y lo
 * heredarían el informe, el simulador y la parrilla que escribe.
 */
class ViolationRedactorTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function aviso(): Violation
    {
        return Violation::notice(
            RuleCode::SharedWorkday,
            'Ese día también trabaja en Bar Central (08:00-12:00).',
            ['company_ids' => [2], 'assignment_ids' => [99]],
        );
    }

    private function redactar(Violation $violation, $user, $company): array
    {
        return (new ViolationRedactor(ScheduleScope::for($user, $company)))
            ->apply(new ValidationResult(collect([$violation])))[0];
    }

    #[Test]
    public function al_encargado_no_le_queda_ni_rastro_del_otro_bar(): void
    {
        $dueno = $this->makeUser();
        $optim = $this->makeCompany($dueno, ['name' => "L'Òptim"]);

        $encargado = $this->makeUser();
        $optim->managers()->attach($encargado);

        $redactado = $this->redactar($this->aviso(), $encargado, $optim);

        // EL AVISO SIGUE ESTANDO. Silenciarlo sería peor que filtrar el nombre: el
        // encargado encadenaría dos jornadas sin enterarse de nada.
        $this->assertSame('shared_workday', $redactado['code']);
        $this->assertSame('notice', $redactado['severity']);
        $this->assertSame('Ese día también trabaja en otra empresa.', $redactado['message']);

        // Y no se cuela el dato ajeno por ninguna rendija: ni por el texto, ni por el
        // contexto, que es por donde viajaban los ids.
        $crudo = json_encode($redactado, JSON_UNESCAPED_UNICODE);

        $this->assertStringNotContainsString('Bar Central', $crudo);
        $this->assertStringNotContainsString('08:00', $crudo);
        $this->assertStringNotContainsString('99', $crudo, 'Los ids del turno ajeno viajaban en el contexto.');
    }

    #[Test]
    public function al_dueno_no_se_le_redacta_porque_los_dos_bares_son_suyos(): void
    {
        // LA CONTRAPRUEBA. Sin ella, el test anterior pasaría igual si el aviso no se
        // emitiera nunca, o si el motor hubiera dejado de saber el nombre — que es justo
        // lo que NO queríamos hacerle al motor.
        $dueno = $this->makeUser();
        $optim = $this->makeCompany($dueno, ['name' => "L'Òptim"]);

        $redactado = $this->redactar($this->aviso(), $dueno, $optim);

        $this->assertStringContainsString('Bar Central', $redactado['message']);
        $this->assertStringContainsString('08:00-12:00', $redactado['message']);
        $this->assertSame([2], $redactado['context']['company_ids']);
    }

    #[Test]
    public function los_demas_avisos_no_se_tocan(): void
    {
        // Solo se redacta lo que filtra. Un incumplimiento de horas no lleva dato ajeno y
        // tiene que llegar entero: redactar de más también es perder información.
        $dueno = $this->makeUser();
        $optim = $this->makeCompany($dueno);

        $encargado = $this->makeUser();
        $optim->managers()->attach($encargado);

        $horas = Violation::breach(
            RuleCode::HourLimit,
            'Se pasa del tope semanal: quedaría en 42h 00min de un máximo de 40h 00min.',
            ['worked_minutes' => 2520, 'limit_minutes' => 2400],
        );

        $redactado = $this->redactar($horas, $encargado, $optim);

        $this->assertStringContainsString('42h 00min', $redactado['message']);
        $this->assertSame(2520, $redactado['context']['worked_minutes']);
    }
}
