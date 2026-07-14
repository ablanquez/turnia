<?php

namespace Tests\Concerns;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\Recurrence;
use App\Models\Absence;
use App\Models\AbsenceType;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\ConceptEntry;
use App\Models\ConceptType;
use App\Models\CoverageRequirement;
use App\Models\Employment;
use App\Models\Holiday;
use App\Models\Person;
use App\Models\Position;
use App\Models\Profile;
use App\Models\User;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use Carbon\CarbonImmutable;

/**
 * Construye el mundo de los tests.
 *
 * Las horas SIEMPRE se dan en hora local de la empresa; el helper las convierte a
 * los instantes UTC que se guardan. Así los tests se leen como los lee un humano
 * ("de 22:00 a 06:00") y siguen probando el comportamiento real.
 */
trait BuildsSchedulingWorld
{
    protected function makeUser(): User
    {
        return User::create([
            'name' => 'Antonio',
            'email' => 'antonio'.uniqid().'@turnia.test',
            'password' => 'secret',
        ]);
    }

    protected function makeCompany(User $user, array $attributes = []): Company
    {
        return $user->companies()->create(array_merge([
            'name' => 'Bar '.uniqid(),
            'timezone' => 'Europe/Madrid',
        ], $attributes));
    }

    protected function makePerson(User $user): Person
    {
        return $user->people()->create(['first_name' => 'María', 'last_name' => 'Gómez']);
    }

    protected function makeProfile(Company $company, array $limits = []): Profile
    {
        return $company->profiles()->create(array_merge([
            'name' => 'Perfil '.uniqid(),
        ], $limits));
    }

    protected function makeEmployment(Company $company, Person $person, ?Profile $profile = null, array $attributes = []): Employment
    {
        return $company->employments()->create(array_merge([
            'person_id' => $person->id,
            'profile_id' => $profile?->id,
            'starts_on' => '2020-01-01',
        ], $attributes));
    }

    protected function makePosition(Company $company, string $name = 'Barra'): Position
    {
        return $company->positions()->create(['name' => $name]);
    }

    protected function makeCalendar(Company $company): Calendar
    {
        return $company->calendars()->create(['name' => 'Calendario '.uniqid()]);
    }

    /** Crea una asignación real. Horas en LOCAL de la empresa. */
    protected function assign(
        Employment $employment,
        Position $position,
        string $workDate,
        string $startLocal,
        string $endLocal,
        ?string $endDate = null,
        ?Calendar $calendar = null,
    ): Assignment {
        $company = $employment->company;
        $calendar ??= $this->makeCalendar($company);

        return Assignment::create([
            'calendar_id' => $calendar->id,
            'employment_id' => $employment->id,
            'position_id' => $position->id,
            'work_date' => $workDate,
            'starts_at' => $company->toUtc($workDate, $startLocal),
            'ends_at' => $company->toUtc($endDate ?? $workDate, $endLocal),
        ]);
    }

    /** El borrador que se va a validar, SIN escribir en la base. */
    protected function draft(
        Employment $employment,
        Position $position,
        string $workDate,
        string $startLocal,
        string $endLocal,
        ?string $endDate = null,
        ?int $ignoreAssignmentId = null,
        // Ninguna regla lo mira, pero ESCRIBIR sí lo necesita. Va al final para no tocar los
        // cientos de drafts que solo validan.
        ?Calendar $calendar = null,
    ): AssignmentDraft {
        $company = $employment->company;

        return new AssignmentDraft(
            employment: $employment,
            position: $position,
            workDate: CarbonImmutable::parse($workDate),
            startsAt: $company->toUtc($workDate, $startLocal),
            endsAt: $company->toUtc($endDate ?? $workDate, $endLocal),
            ignoreAssignmentId: $ignoreAssignmentId,
            calendarId: $calendar?->id,
        );
    }

    protected function makeConceptType(Company $company, Computation $computation, string $name = 'Concepto'): ConceptType
    {
        return $company->conceptTypes()->create([
            'name' => $name.' '.uniqid(),
            'computation' => $computation,
        ]);
    }

    protected function addConcept(
        Employment $employment,
        ConceptType $type,
        string $workDate,
        string $startLocal,
        string $endLocal,
    ): ConceptEntry {
        $company = $employment->company;

        return ConceptEntry::create([
            'employment_id' => $employment->id,
            'concept_type_id' => $type->id,
            'work_date' => $workDate,
            'starts_at' => $company->toUtc($workDate, $startLocal),
            'ends_at' => $company->toUtc($workDate, $endLocal),
        ]);
    }

    /** El borrador de un concepto, SIN escribir en la base. */
    protected function conceptDraft(
        Employment $employment,
        ConceptType $type,
        string $workDate,
        string $startLocal,
        string $endLocal,
        ?string $endDate = null,
        ?int $ignoreConceptEntryId = null,
    ): ConceptEntryDraft {
        $company = $employment->company;

        return new ConceptEntryDraft(
            employment: $employment,
            conceptType: $type,
            workDate: CarbonImmutable::parse($workDate),
            startsAt: $company->toUtc($workDate, $startLocal),
            endsAt: $company->toUtc($endDate ?? $workDate, $endLocal),
            ignoreConceptEntryId: $ignoreConceptEntryId,
        );
    }

    /** El borrador de una ausencia, SIN escribir en la base. */
    protected function absenceDraft(
        Person $person,
        AbsenceType $type,
        string $startsOn,
        ?string $endsOn = null,
        ?Employment $employment = null,
        ?int $ignoreAbsenceId = null,
    ): AbsenceDraft {
        return new AbsenceDraft(
            person: $person,
            absenceType: $type,
            startsOn: CarbonImmutable::parse($startsOn),
            endsOn: $endsOn ? CarbonImmutable::parse($endsOn) : null,
            employment: $employment,
            ignoreAbsenceId: $ignoreAbsenceId,
        );
    }

    protected function makeHoliday(Company $company, string $date, string $name = 'Festivo'): Holiday
    {
        return $company->holidays()->create(['date' => $date, 'name' => $name]);
    }

    protected function makeRequirement(
        Calendar $calendar,
        Position $position,
        Recurrence $recurrence,
        string $startLocal,
        string $endLocal,
        int $count,
        string $effectiveFrom = '2020-01-01',
        ?string $effectiveTo = null,
        ?int $dayOfWeek = null,
        ?string $onDate = null,
    ): CoverageRequirement {
        return CoverageRequirement::create([
            'calendar_id' => $calendar->id,
            'position_id' => $position->id,
            'effective_from' => $effectiveFrom,
            'effective_to' => $effectiveTo,
            'recurrence' => $recurrence,
            'day_of_week' => $dayOfWeek,
            'on_date' => $onDate,
            'starts_at' => $startLocal,
            'ends_at' => $endLocal,
            'required_count' => $count,
        ]);
    }

    protected function makeAbsenceType(
        Company $company,
        AbsenceScope $scope,
        Computation $computation = Computation::Blocks,
        string $name = 'Ausencia',
    ): AbsenceType {
        return $company->absenceTypes()->create([
            'name' => $name.' '.uniqid(),
            'computation' => $computation,
            'scope' => $scope,
        ]);
    }

    protected function addAbsence(
        Person $person,
        AbsenceType $type,
        string $startsOn,
        ?string $endsOn = null,
        ?Employment $employment = null,
    ): Absence {
        return Absence::create([
            'person_id' => $person->id,
            'employment_id' => $employment?->id,
            'absence_type_id' => $type->id,
            'starts_on' => $startsOn,
            'ends_on' => $endsOn,
        ]);
    }
}
