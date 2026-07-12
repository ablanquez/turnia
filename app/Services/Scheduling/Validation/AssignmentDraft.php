<?php

namespace App\Services\Scheduling\Validation;

use App\Models\Assignment;
use App\Models\Employment;
use App\Models\Position;
use Carbon\CarbonImmutable;

/**
 * Lo que se quiere colocar o mover. NO es un modelo: se valida ANTES de tocar la
 * base, y por eso el motor sirve igual para validar, para el informe y para un
 * simulador que no escribe nada.
 *
 * starts_at y ends_at son INSTANTES UTC. work_date es el día LOCAL de negocio al
 * que se imputa el turno (que no coincide con el día de starts_at cuando el turno
 * cruza medianoche).
 */
final readonly class AssignmentDraft
{
    public function __construct(
        public Employment $employment,
        public Position $position,
        public CarbonImmutable $workDate,
        public CarbonImmutable $startsAt,
        public CarbonImmutable $endsAt,
        /** Al MOVER una asignación existente, hay que ignorarla al comparar consigo misma. */
        public ?int $ignoreAssignmentId = null,
    ) {}

    /** Re-validar una asignación ya guardada: se ignora a sí misma. */
    public static function fromAssignment(Assignment $assignment): self
    {
        return new self(
            employment: $assignment->employment,
            position: $assignment->position,
            workDate: CarbonImmutable::parse($assignment->work_date),
            startsAt: CarbonImmutable::parse($assignment->starts_at),
            endsAt: CarbonImmutable::parse($assignment->ends_at),
            ignoreAssignmentId: $assignment->id,
        );
    }

    /**
     * Minutos con signo: negativo si el fin va antes que el inicio.
     *
     * Se calcula sobre los timestamps UTC, no con aritmética de calendario, para
     * que el cambio de hora salga solo.
     */
    public function durationMinutes(): int
    {
        return intdiv($this->endsAt->getTimestamp() - $this->startsAt->getTimestamp(), 60);
    }

    public function personId(): int
    {
        return $this->employment->person_id;
    }
}
