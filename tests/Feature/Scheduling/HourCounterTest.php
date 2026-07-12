<?php

namespace Tests\Feature\Scheduling;

use App\Enums\Computation;
use App\Services\Scheduling\HourCounter;
use App\Services\Scheduling\WindowResolver;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class HourCounterTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private HourCounter $counter;

    private WindowResolver $windows;

    protected function setUp(): void
    {
        parent::setUp();

        $this->counter = app(HourCounter::class);
        $this->windows = app(WindowResolver::class);
    }

    #[Test]
    public function la_misma_funcion_da_semana_mes_y_ano(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // Semana del 13 al 19 de julio de 2026 (lunes a domingo).
        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00'); // 8h, dentro
        $this->assign($employment, $position, '2026-07-22', '09:00', '17:00'); // 8h, otra semana, mismo mes
        $this->assign($employment, $position, '2026-09-10', '09:00', '17:00'); // 8h, otro mes, mismo año

        $date = CarbonImmutable::parse('2026-07-15');

        $this->assertSame(480, $this->counter->workedMinutes($employment, $this->windows->week($date)));
        $this->assertSame(960, $this->counter->workedMinutes($employment, $this->windows->month($date)));
        $this->assertSame(1440, $this->counter->workedMinutes($employment, $this->windows->computationYear($company, $date)));
    }

    #[Test]
    public function la_semana_empieza_en_lunes(): void
    {
        $window = $this->windows->week(CarbonImmutable::parse('2026-07-19')); // domingo

        $this->assertSame('2026-07-13', $window->from->toDateString()); // lunes
        $this->assertSame('2026-07-19', $window->to->toDateString());   // domingo
    }

    #[Test]
    public function el_ano_de_computo_es_movil(): void
    {
        $user = $this->makeUser();

        // Esta empresa cuenta el año desde el 1 de septiembre.
        $company = $this->makeCompany($user, [
            'computation_year_start_month' => 9,
            'computation_year_start_day' => 1,
        ]);

        $agosto = $this->windows->computationYear($company, CarbonImmutable::parse('2026-08-31'));
        $septiembre = $this->windows->computationYear($company, CarbonImmutable::parse('2026-09-01'));

        // El 31 de agosto pertenece TODAVÍA al año que arrancó en septiembre de 2025.
        $this->assertSame('2025-09-01', $agosto->from->toDateString());
        $this->assertSame('2026-08-31', $agosto->to->toDateString());

        // El 1 de septiembre ya es el año siguiente.
        $this->assertSame('2026-09-01', $septiembre->from->toDateString());
        $this->assertSame('2027-08-31', $septiembre->to->toDateString());
    }

    #[Test]
    public function dos_turnos_a_un_dia_de_distancia_caen_en_anos_de_computo_distintos(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, [
            'computation_year_start_month' => 9,
            'computation_year_start_day' => 1,
        ]);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-08-31', '09:00', '17:00'); // año viejo
        $this->assign($employment, $position, '2026-09-01', '09:00', '17:00'); // año nuevo

        $viejo = $this->windows->computationYear($company, CarbonImmutable::parse('2026-08-31'));
        $nuevo = $this->windows->computationYear($company, CarbonImmutable::parse('2026-09-01'));

        $this->assertSame(480, $this->counter->workedMinutes($employment, $viejo));
        $this->assertSame(480, $this->counter->workedMinutes($employment, $nuevo));
    }

    #[Test]
    public function el_turno_nocturno_cruza_medianoche(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // 22:00 -> 06:00 del día siguiente.
        $this->assign($employment, $position, '2026-07-15', '22:00', '06:00', endDate: '2026-07-16');

        $window = $this->windows->week(CarbonImmutable::parse('2026-07-15'));

        $this->assertSame(480, $this->counter->workedMinutes($employment, $window));
    }

    #[Test]
    public function el_turno_nocturno_de_domingo_computa_en_su_semana_no_en_la_siguiente(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // Domingo 19 a las 22:00, termina el LUNES 20 a las 06:00.
        // Se imputa al domingo (work_date), que es la semana del 13 al 19.
        $this->assign($employment, $position, '2026-07-19', '22:00', '06:00', endDate: '2026-07-20');

        $semanaDelTurno = $this->windows->week(CarbonImmutable::parse('2026-07-19'));
        $semanaSiguiente = $this->windows->week(CarbonImmutable::parse('2026-07-20'));

        // Si el contador usara la hora de INICIO en vez de work_date, esto seguiría
        // dando 480. Pero si usara la hora de FIN, se iría a la semana siguiente.
        $this->assertSame(480, $this->counter->workedMinutes($employment, $semanaDelTurno));
        $this->assertSame(0, $this->counter->workedMinutes($employment, $semanaSiguiente));
    }

    #[Test]
    public function la_jornada_partida_son_dos_filas_el_mismo_dia(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');
        $this->assign($employment, $position, '2026-07-15', '17:00', '21:00');

        $window = $this->windows->week(CarbonImmutable::parse('2026-07-15'));

        $this->assertSame(480, $this->counter->workedMinutes($employment, $window));
    }

    #[Test]
    public function la_semana_que_cruza_de_mes_la_parte_bien_el_contador_mensual(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // Semana del 29 de junio al 5 de julio de 2026: cruza el cambio de mes.
        $this->assign($employment, $position, '2026-06-30', '09:00', '17:00'); // junio
        $this->assign($employment, $position, '2026-07-01', '09:00', '17:00'); // julio

        $semana = $this->windows->week(CarbonImmutable::parse('2026-06-30'));
        $junio = $this->windows->month(CarbonImmutable::parse('2026-06-30'));
        $julio = $this->windows->month(CarbonImmutable::parse('2026-07-01'));

        $this->assertSame(960, $this->counter->workedMinutes($employment, $semana)); // la semana los ve los dos
        $this->assertSame(480, $this->counter->workedMinutes($employment, $junio));  // el mes los parte
        $this->assertSame(480, $this->counter->workedMinutes($employment, $julio));
    }

    // ─────────── EL CAMBIO DE HORA ───────────

    #[Test]
    public function la_noche_que_atrasan_el_reloj_el_turno_dura_9_horas_no_8(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user); // Europe/Madrid
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // Madrugada del 25/10/2026: a las 03:00 se vuelve a las 02:00.
        // De 22:00 a 06:00 se viven NUEVE horas, no ocho.
        $this->assign($employment, $position, '2026-10-24', '22:00', '06:00', endDate: '2026-10-25');

        $window = $this->windows->week(CarbonImmutable::parse('2026-10-24'));

        $this->assertSame(540, $this->counter->workedMinutes($employment, $window));
    }

    #[Test]
    public function la_noche_que_adelantan_el_reloj_el_turno_dura_7_horas_no_8(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        // Madrugada del 29/03/2026: a las 02:00 se salta a las 03:00.
        $this->assign($employment, $position, '2026-03-28', '22:00', '06:00', endDate: '2026-03-29');

        $window = $this->windows->week(CarbonImmutable::parse('2026-03-28'));

        $this->assertSame(420, $this->counter->workedMinutes($employment, $window));
    }

    // ─────────── LOS CUATRO computation ───────────

    #[Test]
    public function los_cuatro_valores_de_computation_hacen_cosas_distintas(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00'); // 240 min trabajados

        $this->addConcept($employment, $this->makeConceptType($company, Computation::Adds), '2026-07-14', '10:00', '12:00');            // 120
        $this->addConcept($employment, $this->makeConceptType($company, Computation::SeparateCounter), '2026-07-14', '18:00', '21:00'); // 180
        $this->addConcept($employment, $this->makeConceptType($company, Computation::ReducesRequired), '2026-07-16', '09:00', '10:00'); // 60
        $this->addConcept($employment, $this->makeConceptType($company, Computation::Blocks), '2026-07-17', '09:00', '17:00');          // 480

        $window = $this->windows->week(CarbonImmutable::parse('2026-07-15'));

        // Suman al contador: la asignación (240) + el concepto 'adds' (120).
        $this->assertSame(360, $this->counter->workedMinutes($employment, $window));

        // Contador APARTE, con su propio tope.
        $this->assertSame(180, $this->counter->overtimeMinutes($employment, $window));

        // Resta de la jornada exigible, no suma a la realizada.
        $this->assertSame(60, $this->counter->requiredReductionMinutes($employment, $window));

        // 'blocks' no aparece en NINGUNO de los tres. Si sumara, worked sería 840.
    }

    // ─────────── EL SOFT DELETE NO ES UN RESET ───────────

    #[Test]
    public function borrar_la_empresa_no_resetea_las_horas_ya_trabajadas(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');

        $window = $this->windows->week(CarbonImmutable::parse('2026-07-15'));
        $this->assertSame(480, $this->counter->workedMinutes($employment, $window));

        $company->delete();

        // Las horas se trabajaron. Si dejaran de contar, borrar la empresa sería un
        // truco para resetear los topes de alguien.
        $this->assertSame(480, $this->counter->workedMinutes($employment->fresh(), $window));
    }

    #[Test]
    public function una_asignacion_borrada_deja_de_contar(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user));
        $position = $this->makePosition($company);

        $assignment = $this->assign($employment, $position, '2026-07-15', '09:00', '17:00');
        $window = $this->windows->week(CarbonImmutable::parse('2026-07-15'));

        $assignment->delete();

        $this->assertSame(0, $this->counter->workedMinutes($employment, $window));
    }
}
