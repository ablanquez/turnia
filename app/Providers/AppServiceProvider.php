<?php

namespace App\Providers;

use App\Services\Scheduling\Validation\AbsenceValidator;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use App\Services\Scheduling\Validation\Rules;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Las reglas del motor, por tipo de borrador.
     *
     * Añadir una regla mañana es añadirla a esta lista: ninguna otra clase cambia.
     */
    public const ASSIGNMENT_RULES = [
        Rules\Assignment\IntervalSanityRule::class,
        Rules\Assignment\ContractActiveRule::class,
        Rules\Assignment\OverlapRule::class,
        Rules\Assignment\AvailabilityRule::class,
        Rules\Assignment\EligibilityRule::class,
        Rules\Assignment\HourLimitRule::class,
        Rules\Assignment\MinimumRestRule::class,
        Rules\Assignment\WorkdayTypeRule::class,
        Rules\Assignment\ProfileDefinedRule::class,
        Rules\Assignment\SharedWorkdayRule::class,
    ];

    public const CONCEPT_RULES = [
        Rules\Concept\IntervalSanityRule::class,
        Rules\Concept\ContractActiveRule::class,
        Rules\Concept\OverlapRule::class,
        Rules\Concept\AvailabilityRule::class,
        Rules\Concept\OvertimeLimitRule::class,
    ];

    public const ABSENCE_RULES = [
        Rules\Absence\DateRangeSanityRule::class,
        Rules\Absence\ContractActiveRule::class,
        Rules\Absence\AbsenceOverlapRule::class,
        Rules\Absence\LeaveQuotaRule::class,
        Rules\Absence\OrphanWarningRule::class,
    ];

    public function register(): void
    {
        $this->app->bind(
            AssignmentValidator::class,
            fn ($app) => new AssignmentValidator($this->resolve($app, self::ASSIGNMENT_RULES)),
        );

        $this->app->bind(
            ConceptEntryValidator::class,
            fn ($app) => new ConceptEntryValidator($this->resolve($app, self::CONCEPT_RULES)),
        );

        $this->app->bind(
            AbsenceValidator::class,
            fn ($app) => new AbsenceValidator($this->resolve($app, self::ABSENCE_RULES)),
        );
    }

    public function boot(): void
    {
        //
    }

    /** @param  array<int, class-string>  $rules */
    private function resolve($app, array $rules): array
    {
        return array_map(fn (string $rule) => $app->make($rule), $rules);
    }
}
