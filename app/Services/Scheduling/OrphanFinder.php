<?php

namespace App\Services\Scheduling;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Models\Absence;
use App\Models\Assignment;
use App\Models\Company;
use App\Support\TimeWindow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Las asignaciones que quedan HUÉRFANAS cuando alguien cae de baja.
 *
 * Es una CONSULTA, no un flag. Un flag guardado se volvería mentira en cuanto la
 * baja se acortara, se alargara o se anulara. Esto siempre dice la verdad.
 *
 * Cada huérfana es un hueco al descubierto: ese puesto, ese día, esa franja, sin
 * nadie que lo cubra.
 *
 * @return Collection<int, Assignment>
 */
class OrphanFinder
{
    public function forCompany(Company $company, TimeWindow $window): Collection
    {
        return Assignment::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->whereExists(fn ($query) => $this->blockingAbsenceExists($query))
            ->with(['position', 'employment.person', 'calendar'])
            ->orderBy('work_date')
            ->orderBy('starts_at')
            ->get();
    }

    /**
     * Existe una ausencia que bloquea a esta persona en el día del turno.
     *
     * Se correlaciona con la asignación: mismo person_id, y el work_date dentro del
     * rango de la ausencia (con ends_on NULL = abierta hacia el futuro).
     */
    private function blockingAbsenceExists($query): void
    {
        $query->select('id')
            ->from('absences')
            ->whereColumn('absences.person_id', 'assignments.person_id')
            ->whereNull('absences.deleted_at')
            ->whereColumn('absences.starts_on', '<=', 'assignments.work_date')
            ->where(function ($q) {
                $q->whereNull('absences.ends_on')
                    ->orWhereColumn('absences.ends_on', '>=', 'assignments.work_date');
            })
            ->whereIn('absences.absence_type_id', function ($q) {
                $q->select('id')->from('absence_types')->where('computation', Computation::Blocks->value);
            })
            ->where(function ($q) {
                // De persona: alcanza a cualquier contrato. De contrato: solo al suyo.
                $q->whereIn('absences.absence_type_id', function ($sub) {
                    $sub->select('id')->from('absence_types')->where('scope', AbsenceScope::Person->value);
                })->orWhereColumn('absences.employment_id', 'assignments.employment_id');
            });
    }

    /** La misma consulta, pero para una persona concreta: útil al registrar la baja. */
    public function forAbsence(Absence $absence): Collection
    {
        return Assignment::query()
            ->where('person_id', $absence->person_id)
            ->where('work_date', '>=', $absence->starts_on->toDateString())
            ->when(
                $absence->ends_on !== null,
                fn (Builder $q) => $q->where('work_date', '<=', $absence->ends_on->toDateString()),
            )
            ->when(
                $absence->absenceType->scope === AbsenceScope::Employment,
                fn (Builder $q) => $q->where('employment_id', $absence->employment_id),
            )
            ->with(['position', 'company', 'calendar'])
            ->orderBy('work_date')
            ->get();
    }
}
