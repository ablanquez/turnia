<?php

namespace Tests\Feature\Scheduling;

use App\Enums\Recurrence;
use App\Enums\RuleCode;
use App\Services\Scheduling\CoverageCalculator;
use App\Services\Scheduling\CoverageReport;
use App\Services\Scheduling\CoverageSegment;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class CoverageCalculatorTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $calendar = $this->makeCalendar($company);
        $barra = $this->makePosition($company, 'Barra');

        return compact('user', 'company', 'calendar', 'barra');
    }

    private function un(string $date): TimeWindow
    {
        return new TimeWindow(CarbonImmutable::parse($date), CarbonImmutable::parse($date));
    }

    /**
     * Estos escenarios no tienen empleados cualificados, así que el motor emite
     * (correctamente) un aviso de puesto incubrible. Aquí solo interesa el conflicto
     * que se está probando.
     */
    private function conflictsOf(CoverageReport $report, RuleCode $code): Collection
    {
        return $report->conflicts->filter(fn ($v) => $v->code === $code)->values();
    }

    /** Crea un contrato nuevo con su persona: cada turno lo cubre alguien distinto. */
    private function alguien($company, $calendar, $position, string $date, string $de, string $a, ?string $endDate = null): void
    {
        $employment = $this->makeEmployment($company, $this->makePerson($company->owner));
        $this->assign($employment, $position, $date, $de, $a, endDate: $endDate, calendar: $calendar);
    }

    // ─────────── VIGENCIA ───────────

    #[Test]
    public function un_requisito_vigente_solo_en_agosto_no_aparece_en_julio(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        // En agosto hacen falta 3 de barra los sábados.
        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3,
            effectiveFrom: '2026-08-01', effectiveTo: '2026-08-31', dayOfWeek: 6);

        $julio = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-18')); // sábado
        $agosto = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15')); // sábado

        $this->assertCount(0, $julio->gaps(), 'La necesidad de agosto se está viendo en julio.');
        $this->assertCount(1, $agosto->gaps());
        $this->assertSame(3, $agosto->gaps()->first()->missing());
    }

    // ─────────── LA PRECEDENCIA ───────────

    #[Test]
    public function el_dia_que_el_bar_cierra_no_muestra_un_hueco_fantasma(): void
    {
        // EL CASO QUE JUSTIFICA LA PRECEDENCIA.
        // Los sábados hacen falta 3 de barra. El 25 de diciembre de 2026 cae en viernes,
        // así que usamos el sábado 26: el bar cierra ese día.
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3, dayOfWeek: 6);

        // Sin el requisito de fecha, el sábado 26 pide 3.
        $sinCierre = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-12-26'));
        $this->assertSame(3, $sinCierre->gaps()->first()->missing());

        // Se declara el cierre: un requisito de FECHA con required_count = 0.
        $this->makeRequirement($calendar, $barra, Recurrence::Date, '00:00', '23:59', 0,
            onDate: '2026-12-26');

        $conCierre = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-12-26'));

        // El requisito de fecha ANULA el semanal. Sin precedencia, el motor enseñaría
        // un hueco de 3 personas un día que el bar ni abre, y el encargado aprendería
        // a ignorar los huecos.
        $this->assertCount(0, $conCierre->gaps(), 'Hueco fantasma: el requisito semanal sigue vivo un día cerrado.');
    }

    #[Test]
    public function el_requisito_de_fecha_gana_al_semanal_tambien_cuando_pide_mas_gente(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3, dayOfWeek: 6);
        $this->makeRequirement($calendar, $barra, Recurrence::Date, '12:00', '16:00', 5, onDate: '2026-08-15');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15')); // sábado

        // 5, no 8: el de fecha SUSTITUYE al semanal, no se suma.
        $this->assertCount(1, $report->gaps());
        $this->assertSame(5, $report->gaps()->first()->missing());
    }

    #[Test]
    public function el_semanal_gana_al_diario(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 1);
        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 4, dayOfWeek: 6);

        $sabado = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15'));
        $martes = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-18'));

        $this->assertSame(4, $sabado->gaps()->first()->missing()); // manda el semanal
        $this->assertSame(1, $martes->gaps()->first()->missing()); // el diario, el resto de días
    }

    #[Test]
    public function la_precedencia_es_por_puesto_no_por_dia_entero(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();
        $cocina = $this->makePosition($company, 'Cocina');

        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3, dayOfWeek: 6);
        $this->makeRequirement($calendar, $cocina, Recurrence::Weekly, '12:00', '16:00', 2, dayOfWeek: 6);

        // Se cierra SOLO la barra ese sábado. La cocina sigue con su horario.
        $this->makeRequirement($calendar, $barra, Recurrence::Date, '00:00', '23:59', 0, onDate: '2026-08-15');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15'));

        $this->assertCount(1, $report->gaps());
        $this->assertSame('Cocina', $report->gaps()->first()->position->name);
        $this->assertSame(2, $report->gaps()->first()->missing());
    }

    #[Test]
    public function un_requisito_de_fecha_en_otra_franja_anula_el_semanal_y_lo_dice_bien_alto(): void
    {
        // EL FILO DE LA PRECEDENCIA. Sustituye, no completa.
        //
        // Los sábados hacen falta 3 de barra al mediodía. Alguien añade para el sábado
        // 15 un turno de noche extra con un requisito de FECHA... y con eso borra la
        // demanda del mediodía de ese día.
        //
        // Es el coste aceptado de la precedencia (hay que redeclarar las franjas), pero
        // NO puede pasar en silencio: sería un falso NEGATIVO. El encargado vería
        // "mediodía cubierto" y el bar se quedaría sin barra a la hora de comer, que es
        // peor que un hueco fantasma.
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3, dayOfWeek: 6);
        $this->makeRequirement($calendar, $barra, Recurrence::Date, '20:00', '23:00', 1, onDate: '2026-08-15');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15'));

        // La demanda del mediodía, en efecto, ha desaparecido.
        $this->assertCount(1, $report->gaps());
        $this->assertSame(1, $report->gaps()->first()->missing());

        // Pero el motor lo grita: hay un requisito recurrente anulado.
        $anulados = $this->conflictsOf($report, RuleCode::RequirementOverridden);

        $this->assertCount(1, $anulados);
        $this->assertSame(1, count($anulados->first()->context['overridden_ids']));
    }

    #[Test]
    public function sin_requisitos_anulados_no_hay_ningun_aviso(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Weekly, '12:00', '16:00', 3, dayOfWeek: 6);

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-08-15'));

        $this->assertCount(0, $this->conflictsOf($report, RuleCode::RequirementOverridden));
    }

    // ─────────── LOS SEGMENTOS ───────────

    #[Test]
    public function un_turno_que_cubre_media_franja_deja_el_hueco_donde_de_verdad_esta(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        // Hacen falta 3 de barra de 12:00 a 16:00.
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 3);

        // Y hay UNA persona, pero solo de 12:00 a 14:00.
        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '14:00');

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'))->gaps();

        // Dos huecos distintos, no uno: de 12 a 14 faltan 2 (hay uno), de 14 a 16 faltan 3.
        // Decir "faltan 3 en toda la tarde" sería un aviso falso.
        $this->assertCount(2, $gaps);

        $this->assertSame(2, $gaps[0]->missing());
        $this->assertSame('12:00', $gaps[0]->startsAt->setTimezone('Europe/Madrid')->format('H:i'));
        $this->assertSame('14:00', $gaps[0]->endsAt->setTimezone('Europe/Madrid')->format('H:i'));

        $this->assertSame(3, $gaps[1]->missing());
        $this->assertSame('14:00', $gaps[1]->startsAt->setTimezone('Europe/Madrid')->format('H:i'));
        $this->assertSame('16:00', $gaps[1]->endsAt->setTimezone('Europe/Madrid')->format('H:i'));
    }

    #[Test]
    public function las_demandas_escalonadas_se_suman_en_el_tramo_donde_coinciden(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        // Escalonamiento normal, no un conflicto: 3 de 12 a 16, y 2 más de 14 a 18.
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 3);
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '14:00', '18:00', 2);

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'))->gaps();

        $this->assertCount(3, $gaps);
        $this->assertSame(3, $gaps[0]->missing()); // 12-14
        $this->assertSame(5, $gaps[1]->missing()); // 14-16: se suman las dos demandas
        $this->assertSame(2, $gaps[2]->missing()); // 16-18
    }

    #[Test]
    public function la_cobertura_completa_no_devuelve_nada(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 2);

        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');
        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        $this->assertTrue($report->isFullyCovered());
        $this->assertCount(0, $report->segments);
    }

    #[Test]
    public function el_exceso_tambien_se_informa(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 1);

        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');
        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');
        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        $this->assertCount(0, $report->gaps());
        $this->assertCount(1, $report->excesses());
        $this->assertSame(2, $report->excesses()->first()->excess());
    }

    #[Test]
    public function gente_colocada_un_dia_cerrado_sale_como_exceso(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 2);
        $this->makeRequirement($calendar, $barra, Recurrence::Date, '00:00', '23:59', 0, onDate: '2026-07-15');

        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        $this->assertCount(0, $report->gaps());
        $this->assertCount(1, $report->excesses(), 'Hay alguien trabajando un día cerrado y nadie avisa.');
    }

    // ─────────── MEDIANOCHE ───────────

    #[Test]
    public function una_franja_de_cobertura_que_cruza_medianoche_se_evalua_entera(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        // La barra necesita 2 personas de 22:00 a 06:00.
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '22:00', '06:00', 2);

        // Solo hay una, y además solo hasta las 02:00 de la madrugada siguiente.
        $this->alguien($company, $calendar, $barra, '2026-07-15', '22:00', '02:00', endDate: '2026-07-16');

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'))->gaps();

        $this->assertCount(2, $gaps);
        $this->assertSame(1, $gaps[0]->missing()); // 22:00-02:00: hay 1 de 2
        $this->assertSame(2, $gaps[1]->missing()); // 02:00-06:00: no hay nadie
    }

    // ─────────── CONFIGURACIÓN ───────────

    #[Test]
    public function dos_requisitos_identicos_se_denuncian_como_error_de_configuracion(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 3);
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 3);

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        $this->assertCount(1, $this->conflictsOf($report, RuleCode::DuplicateRequirement));

        // La demanda se ha doblado a 6, y por eso hay que avisar en vez de fusionar en
        // silencio: nadie ha pedido 6.
        $this->assertSame(6, $report->gaps()->first()->missing());
    }

    #[Test]
    public function los_turnos_de_otro_calendario_no_cubren_este(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 1);

        // Alguien cubriendo esa franja, pero en OTRO calendario.
        $otro = $this->makeCalendar($company);
        $this->alguien($company, $otro, $barra, '2026-07-15', '12:00', '16:00');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        $this->assertCount(1, $report->gaps());
    }

    #[Test]
    public function los_tramos_contiguos_con_el_mismo_balance_se_unen(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '10:00', '18:00', 2);

        // Dos turnos consecutivos de la MISMA persona no: son dos personas distintas,
        // una de 10 a 14 y otra de 14 a 18. El déficit es de 1 durante las 8 horas.
        $this->alguien($company, $calendar, $barra, '2026-07-15', '10:00', '14:00');
        $this->alguien($company, $calendar, $barra, '2026-07-15', '14:00', '18:00');

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'))->gaps();

        // Un solo hueco de 10 a 18, no dos: el corte de las 14:00 no cambia el balance.
        $this->assertCount(1, $gaps);
        $this->assertSame(1, $gaps->first()->missing());
        $this->assertSame('10:00', $gaps->first()->startsAt->setTimezone('Europe/Madrid')->format('H:i'));
        $this->assertSame('18:00', $gaps->first()->endsAt->setTimezone('Europe/Madrid')->format('H:i'));
    }

    #[Test]
    public function los_segmentos_llegan_ordenados_en_el_tiempo(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '18:00', '22:00', 1);
        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '09:00', '13:00', 1);

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'))->gaps();

        $this->assertCount(2, $gaps);
        $this->assertTrue(
            $gaps[0]->startsAt->lt($gaps[1]->startsAt),
            'Los segmentos no vienen ordenados: la parrilla los pintaría al revés.',
        );
    }

    #[Test]
    public function un_calendario_sin_requisitos_no_tiene_huecos(): void
    {
        ['company' => $company, 'calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->alguien($company, $calendar, $barra, '2026-07-15', '12:00', '16:00');

        $report = app(CoverageCalculator::class)->forCalendar($calendar, $this->un('2026-07-15'));

        // Sin demanda declarada no hay hueco... pero tampoco exceso: nadie ha dicho
        // cuánta gente hace falta, así que el motor no opina.
        $this->assertCount(0, $report->gaps());
        $this->assertCount(0, $report->segments);
    }

    #[Test]
    public function la_ventana_de_varios_dias_evalua_cada_dia(): void
    {
        ['calendar' => $calendar, 'barra' => $barra] = $this->mundo();

        $this->makeRequirement($calendar, $barra, Recurrence::Daily, '12:00', '16:00', 1);

        $semana = new TimeWindow(CarbonImmutable::parse('2026-07-13'), CarbonImmutable::parse('2026-07-19'));

        $gaps = app(CoverageCalculator::class)->forCalendar($calendar, $semana)->gaps();

        $this->assertCount(7, $gaps);
        $this->assertSame('2026-07-13', $gaps->first()->workDate->toDateString());
        $this->assertSame('2026-07-19', $gaps->last()->workDate->toDateString());
        $gaps->each(fn (CoverageSegment $s) => $this->assertSame(1, $s->missing()));
    }
}
