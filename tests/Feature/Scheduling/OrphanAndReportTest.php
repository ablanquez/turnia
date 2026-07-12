<?php

namespace Tests\Feature\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\RuleCode;
use App\Services\Scheduling\OrphanFinder;
use App\Services\Scheduling\ViolationReport;
use App\Services\Scheduling\WindowResolver;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class OrphanAndReportTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function la_baja_deja_huerfanos_los_turnos_futuros_de_las_dos_empresas(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        $enA = $this->makeEmployment($barA, $maria);
        $enB = $this->makeEmployment($barB, $maria);

        $barraA = $this->makePosition($barA);
        $cocinaB = $this->makePosition($barB);

        $this->assign($enA, $barraA, '2026-07-14', '09:00', '17:00'); // antes de la baja
        $this->assign($enA, $barraA, '2026-07-16', '09:00', '17:00'); // huérfano
        $this->assign($enA, $barraA, '2026-07-17', '09:00', '17:00'); // huérfano
        $this->assign($enB, $cocinaB, '2026-07-16', '18:00', '22:00'); // huérfano, en la OTRA empresa

        $baja = $this->makeAbsenceType($barA, AbsenceScope::Person, name: 'Baja laboral');
        $this->addAbsence($maria, $baja, '2026-07-15', endsOn: null);

        $finder = app(OrphanFinder::class);
        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-15'));

        $huerfanasA = $finder->forCompany($barA, $window);
        $huerfanasB = $finder->forCompany($barB, $window);

        $this->assertCount(2, $huerfanasA, 'El turno anterior a la baja no debería ser huérfano.');
        $this->assertCount(1, $huerfanasB, 'La baja de persona deja huérfanos también en la otra empresa.');

        // Cada huérfana es un hueco: qué puesto, qué día, qué franja.
        $this->assertSame('2026-07-16', $huerfanasA->first()->work_date->toDateString());
        $this->assertNotNull($huerfanasA->first()->position->name);
    }

    #[Test]
    public function las_vacaciones_de_una_empresa_no_dejan_huerfanos_en_la_otra(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user);
        $barB = $this->makeCompany($user);

        $enA = $this->makeEmployment($barA, $maria);
        $enB = $this->makeEmployment($barB, $maria);

        $this->assign($enA, $this->makePosition($barA), '2026-07-16', '09:00', '13:00');
        $this->assign($enB, $this->makePosition($barB), '2026-07-16', '18:00', '22:00');

        $vacaciones = $this->makeAbsenceType($barA, AbsenceScope::Employment, name: 'Vacaciones');
        $this->addAbsence($maria, $vacaciones, '2026-07-13', '2026-07-19', employment: $enA);

        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-16'));
        $finder = app(OrphanFinder::class);

        $this->assertCount(1, $finder->forCompany($barA, $window));
        $this->assertCount(0, $finder->forCompany($barB, $window), 'Las vacaciones del Bar A se colaron al Bar B.');
    }

    #[Test]
    public function anular_la_baja_hace_desaparecer_las_huerfanas_sin_tocar_nada_mas(): void
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $maria);

        $this->assign($employment, $this->makePosition($company), '2026-07-16', '09:00', '17:00');

        $baja = $this->makeAbsenceType($company, AbsenceScope::Person);
        $absence = $this->addAbsence($maria, $baja, '2026-07-15', endsOn: null);

        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-16'));
        $finder = app(OrphanFinder::class);

        $this->assertCount(1, $finder->forCompany($company, $window));

        // Se anula la baja. Como las huérfanas son una CONSULTA y no un flag, la
        // verdad cambia sola: no hay ningún campo que actualizar ni que se quede viejo.
        $absence->delete();

        $this->assertCount(0, $finder->forCompany($company, $window));
    }

    #[Test]
    public function el_informe_deriva_los_incumplimientos_de_la_semana(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, [
            'max_minutes_week' => 600,               // 10h
            'min_rest_minutes_between_shifts' => 720, // 12h
        ]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '14:00', '22:00'); // 8h
        $this->assign($employment, $position, '2026-07-16', '06:00', '14:00'); // 8h: 8h de descanso, y 16h > 10h

        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-15'));

        $report = app(ViolationReport::class)->forCompany($company, $window);

        // LOS DOS turnos aparecen, y es correcto: un descanso corto implica a los
        // dos turnos que lo forman (al primero le rompen el descanso por detrás), y
        // el tope semanal lo revientan entre ambos. El informe señala turnos
        // implicados, no "culpables": quién sobra lo decide el humano.
        $this->assertCount(2, $report);

        foreach ($report as $row) {
            $this->assertTrue($row['result']->has(RuleCode::MinimumRest));
            $this->assertTrue($row['result']->has(RuleCode::HourLimit));
        }
    }

    #[Test]
    public function el_informe_dice_la_verdad_despues_de_que_cambien_otras_filas(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_minutes_week' => 2400]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '09:00', '17:00'); // 8h, limpio

        $window = app(WindowResolver::class)->week(CarbonImmutable::parse('2026-07-15'));

        $this->assertCount(0, app(ViolationReport::class)->forCompany($company, $window));

        // Ahora le BAJAN el perfil a 4h semanales. No se ha tocado la asignación:
        // se ha tocado OTRA fila. Un incumplimiento guardado seguiría diciendo
        // "limpio" y estaría mintiendo. Al derivarse, aparece solo.
        $profile->update(['max_minutes_week' => 240]);

        $report = app(ViolationReport::class)->forCompany($company, $window);

        $this->assertCount(1, $report);
        $this->assertTrue($report->first()['result']->has(RuleCode::HourLimit));
    }
}
