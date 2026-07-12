<?php

namespace App\Providers;

use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\Rules\AvailabilityRule;
use App\Services\Scheduling\Validation\Rules\ContractActiveRule;
use App\Services\Scheduling\Validation\Rules\EligibilityRule;
use App\Services\Scheduling\Validation\Rules\HourLimitRule;
use App\Services\Scheduling\Validation\Rules\IntervalSanityRule;
use App\Services\Scheduling\Validation\Rules\MinimumRestRule;
use App\Services\Scheduling\Validation\Rules\OverlapRule;
use App\Services\Scheduling\Validation\Rules\ProfileDefinedRule;
use App\Services\Scheduling\Validation\Rules\SharedWorkdayRule;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Las reglas del motor, en el orden en que se comprueban.
     *
     * Añadir una regla mañana es añadirla a esta lista: ninguna otra clase cambia.
     */
    public const SCHEDULING_RULES = [
        IntervalSanityRule::class,
        ContractActiveRule::class,
        OverlapRule::class,
        AvailabilityRule::class,
        EligibilityRule::class,
        HourLimitRule::class,
        MinimumRestRule::class,
        ProfileDefinedRule::class,
        SharedWorkdayRule::class,
    ];

    public function register(): void
    {
        $this->app->bind(AssignmentValidator::class, function ($app) {
            return new AssignmentValidator(
                array_map(fn (string $rule) => $app->make($rule), self::SCHEDULING_RULES),
            );
        });
    }

    public function boot(): void
    {
        //
    }
}
