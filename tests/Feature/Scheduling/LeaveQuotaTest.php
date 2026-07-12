<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\AbsenceValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL CUPO DE VACACIONES: DONDE MÁS FÁCIL SE ROMPE.
 *
 * Se mide en DÍAS LABORABLES, y qué día es laborable lo dice la EMPRESA
 * (non_working_weekdays + holidays), no el código.
 */
class LeaveQuotaTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(array $companyAttrs = [], ?int $quota = 22): array
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, $companyAttrs);
        $person = $this->makePerson($user);
        $profile = $this->makeProfile($company, ['annual_leave_days' => $quota]);
        $employment = $this->makeEmployment($company, $person, $profile);

        $vacaciones = $company->absenceTypes()->create([
            'name' => 'Vacaciones',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Employment,
            'consumes_leave_quota' => true,
        ]);

        return compact('user', 'company', 'person', 'profile', 'employment', 'vacaciones');
    }

    #[Test]
    public function un_festivo_dentro_de_las_vacaciones_no_consume_cupo(): void
    {
        // Cupo de 3 días. Del miércoles 12 al viernes 14 de agosto = 3 laborables...
        ['company' => $company, 'person' => $person, 'employment' => $employment,
            'vacaciones' => $vacaciones] = $this->mundo(quota: 3);

        $sinFestivo = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-12', '2026-08-14', $employment)
        );
        $this->assertFalse($sinFestivo->has(RuleCode::LeaveQuota), '3 laborables con cupo de 3: cabe justo.');

        // ...pero si le sumamos el lunes 17, son 4 y se pasa.
        $seExcede = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-12', '2026-08-17', $employment)
        );
        $this->assertTrue($seExcede->has(RuleCode::LeaveQuota));

        // Y ahora declaramos festivo el jueves 13. Ese día ya NO consume cupo, así que
        // el mismo rango 12-17 pasa a ser 3 laborables y vuelve a caber.
        $this->makeHoliday($company, '2026-08-13', 'Fiesta local');

        $conFestivo = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-12', '2026-08-17', $employment)
        );

        $this->assertFalse(
            $conFestivo->has(RuleCode::LeaveQuota),
            'El festivo se está descontando del cupo: no ibas a trabajar ese día.',
        );
    }

    #[Test]
    public function el_fin_de_semana_dentro_de_las_vacaciones_no_consume_cupo(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(quota: 5);

        // Del lunes 10 al domingo 16 de agosto: 7 días naturales, pero solo 5 laborables.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-10', '2026-08-16', $employment)
        );

        // Si contara días naturales, 7 > 5 y saltaría.
        $this->assertFalse($result->has(RuleCode::LeaveQuota));
    }

    #[Test]
    public function una_empresa_que_libra_el_lunes_respeta_su_configuracion(): void
    {
        // Este bar abre sábado y domingo, y libra el LUNES.
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(
            companyAttrs: ['non_working_weekdays' => [1]],
            quota: 5,
        );

        // Del sábado 8 al miércoles 12 de agosto: 5 días naturales.
        // Para este bar, el sábado y el domingo SÍ son laborables; el lunes NO.
        // Laborables: sáb 8, dom 9, mar 11, mié 12 = 4. Cabe en el cupo de 5.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-08', '2026-08-12', $employment)
        );

        $this->assertFalse($result->has(RuleCode::LeaveQuota));

        // Y si el motor asumiera sábado/domingo como no laborables, contaría solo 3
        // (lun, mar, mié) y también pasaría. Así que hay que apretar: con cupo de 3,
        // el cálculo correcto (4) debe saltar y el asumido (3) no.
        $employment->update(['annual_leave_days_override' => 3]);

        $apretado = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones->fresh(), '2026-08-08', '2026-08-12', $employment->fresh())
        );

        $this->assertTrue(
            $apretado->has(RuleCode::LeaveQuota),
            'El motor está asumiendo sábado y domingo en vez de leer non_working_weekdays.',
        );
        $this->assertSame(4, $apretado->violations->first()->context['new_days']);
    }

    #[Test]
    public function las_vacaciones_que_cruzan_el_fin_del_ano_movil_se_parten_por_la_frontera(): void
    {
        // Año de cómputo que arranca el 1 de septiembre.
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(
            companyAttrs: ['computation_year_start_month' => 9, 'computation_year_start_day' => 1],
            quota: 5,
        );

        // Del martes 25 de agosto al viernes 4 de septiembre.
        //   Año viejo (hasta el 31 de agosto): 25, 26, 27, 28 y 31 = 5 laborables.
        //   Año nuevo (desde el 1 de septiembre): 1, 2, 3 y 4 = 4 laborables.
        // Total: 9 laborables. Con cupo de 5 POR AÑO, cabe en los dos.
        //
        // Este caso es el que distingue: si los 9 se contaran contra un solo año,
        // saltaría el cupo. Solo pasa si de verdad se parten por la frontera.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-25', '2026-09-04', $employment)
        );

        $this->assertFalse(
            $result->has(RuleCode::LeaveQuota),
            'Los 9 días se están contando contra un solo año en vez de partirse por la frontera.',
        );
    }

    #[Test]
    public function no_se_pueden_colar_40_dias_saltando_la_frontera_del_ano(): void
    {
        // Contrapunto del anterior, y el que de verdad importa: partir por la frontera
        // no puede convertirse en un agujero. 8 laborables en el año viejo con cupo de
        // 5 tiene que saltar, aunque la ausencia cruce la frontera.
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(
            companyAttrs: ['computation_year_start_month' => 9, 'computation_year_start_day' => 1],
            quota: 5,
        );

        // Del lunes 17 de agosto al viernes 4 de septiembre.
        // Año viejo: del 17 al 31 de agosto = 11 laborables. Se pasa de 5.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-08-17', '2026-09-04', $employment)
        );

        $this->assertTrue($result->has(RuleCode::LeaveQuota));

        $violation = $result->violations->first(fn ($v) => $v->code === RuleCode::LeaveQuota);
        $this->assertSame('2025-09-01', $violation->context['window_from']);
    }

    #[Test]
    public function agotar_el_cupo_exactamente_cumple(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(quota: 10);

        // 5 laborables ya cogidos (lun 6 a vie 10 de julio).
        $this->addAbsence($person, $vacaciones, '2026-07-06', '2026-07-10', $employment);

        // Otros 5 (lun 13 a vie 17). Total: 10 de 10. Es un MÁXIMO: cumple.
        $justo = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-17', $employment)
        );
        $this->assertFalse($justo->has(RuleCode::LeaveQuota));

        // Un día más y se pasa.
        $unoMas = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-07-13', '2026-07-20', $employment)
        );
        $this->assertTrue($unoMas->has(RuleCode::LeaveQuota));
        $this->assertSame(1, $unoMas->violations->first(fn ($v) => $v->code === RuleCode::LeaveQuota)
            ->context['excess_days']);
    }

    #[Test]
    public function el_cupo_es_independiente_por_contrato(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria, $this->makeProfile($barA, ['annual_leave_days' => 5]));
        $enB = $this->makeEmployment($barB, $maria, $this->makeProfile($barB, ['annual_leave_days' => 5]));

        $vacA = $this->makeAbsenceType($barA, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones A');
        $vacA->update(['consumes_leave_quota' => true]);
        $vacB = $this->makeAbsenceType($barB, AbsenceScope::Employment, Computation::Blocks, 'Vacaciones B');
        $vacB->update(['consumes_leave_quota' => true]);

        // Agota el cupo entero en el Bar A: 5 laborables.
        $this->addAbsence($maria, $vacA->fresh(), '2026-07-06', '2026-07-10', $enA);

        // Y ahora pide 5 días en el Bar B. Su cupo del Bar B está intacto.
        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($maria, $vacB->fresh(), '2026-07-13', '2026-07-17', $enB)
        );

        $this->assertFalse(
            $result->has(RuleCode::LeaveQuota),
            'El cupo del Bar A se está comiendo el del Bar B.',
        );
    }

    #[Test]
    public function sin_cupo_definido_no_se_incumple_nunca(): void
    {
        ['person' => $person, 'employment' => $employment, 'vacaciones' => $vacaciones] = $this->mundo(quota: null);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $vacaciones, '2026-01-01', '2026-12-31', $employment)
        );

        // null = sin límite. NO es cero.
        $this->assertFalse($result->has(RuleCode::LeaveQuota));
    }

    #[Test]
    public function un_tipo_que_consume_cupo_pero_es_de_alcance_persona_avisa_de_la_contradiccion(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $this->makeProfile($company, ['annual_leave_days' => 22]));

        // Configuración contradictoria: consume cupo, pero no tiene contrato del que
        // descontarlo.
        $raro = $company->absenceTypes()->create([
            'name' => 'Vacaciones mal configuradas',
            'computation' => Computation::Blocks,
            'scope' => AbsenceScope::Person,
            'consumes_leave_quota' => true,
        ]);

        $result = app(AbsenceValidator::class)->validate(
            $this->absenceDraft($person, $raro, '2026-07-06', '2026-07-10')
        );

        // Ni consume cupo de nadie, ni se calla: el problema está en la configuración.
        $this->assertTrue($result->has(RuleCode::QuotaScopeMismatch));
        $this->assertFalse($result->has(RuleCode::LeaveQuota));
        $this->assertTrue($result->isPossible());
    }
}
