<?php

namespace App\Services\Scheduling\Validation;

use App\Enums\AbsenceScope;
use App\Models\Absence;
use App\Models\AbsenceType;
use App\Models\Company;
use App\Models\Employment;
use App\Models\Person;
use Carbon\CarbonImmutable;

/**
 * Una ausencia que se quiere registrar: baja, vacaciones, permiso largo.
 *
 * employment NULL significa que afecta a TODOS los contratos de la persona (una
 * baja: el tobillo roto no distingue de bares). Con contrato, solo a ese.
 *
 * endsOn NULL = baja abierta, de duración indefinida.
 */
final readonly class AbsenceDraft
{
    public function __construct(
        public Person $person,
        public AbsenceType $absenceType,
        public CarbonImmutable $startsOn,
        public ?CarbonImmutable $endsOn,
        public ?Employment $employment = null,
        public ?int $ignoreAbsenceId = null,
    ) {}

    public static function fromAbsence(Absence $absence): self
    {
        return new self(
            person: $absence->person,
            absenceType: $absence->absenceType,
            startsOn: CarbonImmutable::parse($absence->starts_on),
            endsOn: $absence->ends_on ? CarbonImmutable::parse($absence->ends_on) : null,
            employment: $absence->employment,
            ignoreAbsenceId: $absence->id,
        );
    }

    /** La empresa dueña del catálogo: de ella salen los festivos y los días no laborables. */
    public function company(): Company
    {
        return $this->absenceType->company;
    }

    public function scope(): AbsenceScope
    {
        return $this->absenceType->scope;
    }

    public function isOpenEnded(): bool
    {
        return $this->endsOn === null;
    }
}
