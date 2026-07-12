<?php

namespace Tests\Feature\Presentation;

use App\Services\Scheduling\Presentation\TimeAxis;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL EJE DE LA PARRILLA.
 *
 * Estos tests existen por un bug REAL que no reventó: pintaba. La conversión restaba
 * la medianoche UTC del work_date de la medianoche LOCAL del mismo día, que en Madrid
 * en verano es la víspera a las 22:00. La resta daba -0,083 días, por 24 daba -2, y
 * TODA la parrilla salía dos horas antes de su hora real.
 *
 * Nadie habría visto un error. Habría visto un cuadrante.
 *
 * ⚠️ Y con la empresa en UTC el desfase habría sido CERO: un test escrito sin zona
 * horaria de verdad habría pasado en verde y no habría cazado nada. Por eso aquí la
 * empresa está en Europe/Madrid, y hay un caso en Canarias.
 */
class TimeAxisTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function la_hora_que_se_pinta_es_la_del_reloj_de_la_empresa_no_la_utc(): void
    {
        $company = $this->makeCompany($this->makeUser(), ['timezone' => 'Europe/Madrid']);

        $workDate = CarbonImmutable::parse('2026-07-06');

        // Las 12:00 en el bar, en pleno julio, son las 10:00 UTC.
        $instant = $company->toUtc('2026-07-06', '12:00');
        $this->assertSame('10:00', $instant->format('H:i'), 'El instante guardado es UTC.');

        // Pero en la parrilla tiene que caer en las 12, que es donde el encargado la busca.
        $this->assertSame(12.0, TimeAxis::hourOf($instant, $workDate, $company));
    }

    #[Test]
    public function el_turno_nocturno_cruza_el_borde_del_dia(): void
    {
        $company = $this->makeCompany($this->makeUser(), ['timezone' => 'Europe/Madrid']);
        $workDate = CarbonImmutable::parse('2026-07-06');

        $entra = $company->toUtc('2026-07-06', '22:00');
        $sale = $company->toUtc('2026-07-07', '06:00');

        $this->assertSame(22.0, TimeAxis::hourOf($entra, $workDate, $company));

        // 30, no 6: es lo que hace que la barra se VEA cruzando el borde en vez de
        // aparecer al principio del mismo día, que sería una mentira dibujada.
        $this->assertSame(30.0, TimeAxis::hourOf($sale, $workDate, $company));
    }

    #[Test]
    public function la_madrugada_del_panadero_ensancha_el_eje_en_vez_de_recortarse(): void
    {
        $company = $this->makeCompany($this->makeUser(), ['timezone' => 'Europe/Madrid']);
        $workDate = CarbonImmutable::parse('2026-07-06');

        // El eje por defecto empieza a las 06:00. Una panadería entra a las 04:00.
        $entra = TimeAxis::hourOf($company->toUtc('2026-07-06', '04:00'), $workDate, $company);

        $axis = TimeAxis::covering([$entra, 12.0]);

        $this->assertSame(4.0, $axis->from, 'El eje se ensancha: recortar la barra sería dibujar una mentira.');
        $this->assertSame(30.0, $axis->to, 'Y no se encoge por debajo del día completo.');
        $this->assertSame(0.0, $axis->percent(4.0));
    }

    #[Test]
    public function cada_empresa_se_pinta_en_su_propio_huso(): void
    {
        // El mismo INSTANTE, en dos bares del mismo dueño. Canarias va una hora por
        // detrás de la Península: el turno cae en una hora distinta de cada parrilla, y
        // las dos son verdad.
        $user = $this->makeUser();
        $madrid = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $canarias = $this->makeCompany($user, ['timezone' => 'Atlantic/Canary']);

        $workDate = CarbonImmutable::parse('2026-07-06');
        $instant = $madrid->toUtc('2026-07-06', '12:00');

        $this->assertSame(12.0, TimeAxis::hourOf($instant, $workDate, $madrid));
        $this->assertSame(11.0, TimeAxis::hourOf($instant, $workDate, $canarias));
    }

    #[Test]
    public function la_noche_del_cambio_de_hora_el_reloj_manda_en_el_dibujo(): void
    {
        // 25 de octubre de 2026: los relojes se atrasan a las 03:00. El turno de 22:00 a
        // 06:00 dura NUEVE horas de verdad, y el contador ya lo sabe (calcula sobre UTC).
        //
        // Pero la parrilla es un instrumento de RELOJ DE PARED: el encargado lee "entra a
        // las 22:00 y sale a las 06:00". El eje pinta el reloj, no el cronómetro.
        $company = $this->makeCompany($this->makeUser(), ['timezone' => 'Europe/Madrid']);
        $workDate = CarbonImmutable::parse('2026-10-24');

        $entra = $company->toUtc('2026-10-24', '22:00');
        $sale = $company->toUtc('2026-10-25', '06:00');

        // Nueve horas reales entre los dos instantes...
        $this->assertSame(9 * 60, intdiv($sale->getTimestamp() - $entra->getTimestamp(), 60));

        // ...y sin embargo, en el eje, de las 22 a las 30. Que es lo que dice el reloj.
        $this->assertSame(22.0, TimeAxis::hourOf($entra, $workDate, $company));
        $this->assertSame(30.0, TimeAxis::hourOf($sale, $workDate, $company));
    }
}
