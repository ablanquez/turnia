<?php

namespace App\Services\Scheduling;

use App\Models\Absence;
use App\Models\Assignment;
use App\Models\Company;
use App\Models\ConceptEntry;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceValidator;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ConceptEntryDraft;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use App\Support\TimeWindow;
use Illuminate\Support\Collection;

/**
 * "Esta semana hay 3 turnos que rompen el descanso."
 *
 * Los incumplimientos NO se guardan: se DERIVAN re-validando la ventana. Guardar un
 * incumplimiento sería peor que guardar un contador acumulado — un contador se
 * desincroniza cuando tocas SUS filas, pero un incumplimiento depende de OTRAS filas
 * (una baja nueva, un turno en la otra empresa, un perfil que cambia), así que se
 * volvería mentira sin que nadie lo hubiera tocado.
 *
 * Re-valida LOS TRES sujetos, no solo las asignaciones. Mirar solo los turnos dejaba
 * un silencio falso: una hora médica registrada el jueves y una baja registrada
 * después que cubre ese jueves se contradicen, y nadie lo veía nunca porque nadie
 * volvía a mirar los conceptos.
 *
 * Es más caro, sí. Pero es un informe, no la parrilla.
 */
class ViolationReport
{
    public function __construct(
        private AssignmentValidator $assignments,
        private ConceptEntryValidator $concepts,
        private AbsenceValidator $absences,
    ) {}

    /** @return Collection<int, ReportedViolation> */
    public function forCompany(Company $company, TimeWindow $window): Collection
    {
        return $this->assignmentRows($company, $window)
            ->concat($this->conceptRows($company, $window))
            ->concat($this->absenceRows($company, $window))
            ->values();
    }

    private function assignmentRows(Company $company, TimeWindow $window): Collection
    {
        return Assignment::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->with(['employment.profile', 'employment.company', 'position', 'override.user'])
            ->orderBy('work_date')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (Assignment $a) => new ReportedViolation(
                'assignment', $a, $this->assignments->validate(AssignmentDraft::fromAssignment($a)),
            ))
            ->reject(fn (ReportedViolation $row) => $row->result->isClean());
    }

    private function conceptRows(Company $company, TimeWindow $window): Collection
    {
        return ConceptEntry::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->with(['employment.profile', 'employment.company', 'conceptType'])
            ->orderBy('work_date')
            ->get()
            ->map(fn (ConceptEntry $e) => new ReportedViolation(
                'concept_entry', $e, $this->concepts->validate(ConceptEntryDraft::fromEntry($e)),
            ))
            ->reject(fn (ReportedViolation $row) => $row->result->isClean());
    }

    /**
     * Las ausencias que TOCAN la ventana, aunque empezaran antes: una baja abierta de
     * hace un año sigue vigente hoy, y sus contradicciones también.
     */
    private function absenceRows(Company $company, TimeWindow $window): Collection
    {
        return Absence::query()
            ->where('company_id', $company->id)
            ->where('starts_on', '<=', $window->to->toDateString())
            ->where(fn ($q) => $q->whereNull('ends_on')->orWhere('ends_on', '>=', $window->from->toDateString()))
            ->with(['person', 'employment.profile', 'employment.company', 'absenceType.company'])
            ->orderBy('starts_on')
            ->get()
            ->map(fn (Absence $a) => new ReportedViolation(
                'absence', $a, $this->absences->validate(AbsenceDraft::fromAbsence($a)),
            ))
            ->reject(fn (ReportedViolation $row) => $row->result->isClean());
    }
}
