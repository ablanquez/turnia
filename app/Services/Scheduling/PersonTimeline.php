<?php

namespace App\Services\Scheduling;

use App\Models\Assignment;
use App\Models\ConceptEntry;
use Carbon\CarbonImmutable;

/**
 * Qué ocupa a una PERSONA en una franja de tiempo, en CUALQUIER empresa.
 *
 * El criterio del solape vive aquí y en un solo sitio. Si lo copiara en la regla de
 * asignaciones y en la de conceptos, el día que cambiara me quedaría una copia vieja
 * mintiendo.
 *
 * Intervalos SEMIABIERTOS [inicio, fin): lo que acaba a las 22:00 no solapa con lo
 * que empieza a las 22:00.
 */
class PersonTimeline
{
    public function occupations(
        int $personId,
        CarbonImmutable $from,
        CarbonImmutable $to,
        ?int $exceptAssignmentId = null,
        ?int $exceptConceptEntryId = null,
    ): Occupations {
        $assignments = Assignment::query()
            ->where('person_id', $personId)
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->when($exceptAssignmentId, fn ($q, $id) => $q->whereKeyNot($id))
            ->with('company')
            ->get();

        $concepts = ConceptEntry::query()
            ->where('person_id', $personId)
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->when($exceptConceptEntryId, fn ($q, $id) => $q->whereKeyNot($id))
            ->with(['conceptType', 'company'])
            ->get();

        return new Occupations($assignments, $concepts);
    }
}
