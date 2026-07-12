<?php

namespace Tests\Feature\Scheduling;

use App\Enums\WorkdayType;
use App\Services\Scheduling\LimitResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

class LimitResolverTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function la_excepcion_individual_gana_al_perfil(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, [
            'max_minutes_week' => 2400,
            'min_rest_minutes_between_shifts' => 720,
        ]);

        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile, [
            'max_minutes_week_override' => 1200,
        ]);

        $limits = app(LimitResolver::class)->for($employment);

        $this->assertSame(1200, $limits->maxMinutesWeek);   // gana el override
        $this->assertSame(720, $limits->minRestMinutesBetweenShifts); // sin override: cae al perfil
    }

    #[Test]
    public function null_significa_sin_limite_y_no_cero(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);

        // Perfil con TODOS los límites a null.
        $profile = $this->makeProfile($company);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);

        $limits = app(LimitResolver::class)->for($employment);

        $this->assertNull($limits->maxMinutesWeek);
        $this->assertNull($limits->maxMinutesMonth);
        $this->assertNull($limits->maxMinutesYear);
        $this->assertNull($limits->maxMinutesPerShift);
        $this->assertNull($limits->minRestMinutesBetweenShifts);

        // Y no es cero: no son lo mismo ni por asomo.
        $this->assertNotSame(0, $limits->maxMinutesWeek);
        $this->assertTrue($limits->hasProfile);
    }

    #[Test]
    public function un_override_a_cero_si_es_un_limite_de_cero(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, ['max_minutes_week' => 2400]);

        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile, [
            'max_minutes_week_override' => 0,
        ]);

        $limits = app(LimitResolver::class)->for($employment);

        // OJO: 0 ?? $perfil daría 0 (correcto). Pero si alguien usara ?: en vez de ??,
        // el cero caería al valor del perfil y el límite de cero se perdería.
        $this->assertSame(0, $limits->maxMinutesWeek);
    }

    #[Test]
    public function sin_perfil_no_hay_limites_pero_queda_registrado_que_falta(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), profile: null);

        $limits = app(LimitResolver::class)->for($employment);

        $this->assertFalse($limits->hasProfile);
        $this->assertNull($limits->maxMinutesWeek);
        $this->assertSame(WorkdayType::Any, $limits->workdayType);
    }

    #[Test]
    public function sin_perfil_pero_con_override_el_override_manda(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $employment = $this->makeEmployment($company, $this->makePerson($user), profile: null, attributes: [
            'max_minutes_week_override' => 900,
        ]);

        $limits = app(LimitResolver::class)->for($employment);

        $this->assertSame(900, $limits->maxMinutesWeek);
        $this->assertFalse($limits->hasProfile);
    }
}
