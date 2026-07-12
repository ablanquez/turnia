<?php

namespace App\Services\Scheduling\Validation;

use App\Models\ConceptEntry;
use App\Models\ConceptType;
use App\Models\Employment;
use Carbon\CarbonImmutable;

/**
 * Un concepto horario que se quiere registrar o mover: hora médica, permiso, hora
 * extra. Ocupa tiempo de la persona, pero no cubre ningún puesto.
 *
 * starts_at y ends_at son INSTANTES UTC; work_date es el día LOCAL de negocio.
 */
final readonly class ConceptEntryDraft
{
    public function __construct(
        public Employment $employment,
        public ConceptType $conceptType,
        public CarbonImmutable $workDate,
        public CarbonImmutable $startsAt,
        public CarbonImmutable $endsAt,
        public ?int $ignoreConceptEntryId = null,
    ) {}

    public static function fromEntry(ConceptEntry $entry): self
    {
        return new self(
            employment: $entry->employment,
            conceptType: $entry->conceptType,
            workDate: CarbonImmutable::parse($entry->work_date),
            startsAt: CarbonImmutable::parse($entry->starts_at),
            endsAt: CarbonImmutable::parse($entry->ends_at),
            ignoreConceptEntryId: $entry->id,
        );
    }

    /** Minutos con signo, sobre timestamps UTC: el cambio de hora sale solo. */
    public function durationMinutes(): int
    {
        return intdiv($this->endsAt->getTimestamp() - $this->startsAt->getTimestamp(), 60);
    }

    public function personId(): int
    {
        return $this->employment->person_id;
    }
}
