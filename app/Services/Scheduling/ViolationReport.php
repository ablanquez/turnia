<?php

namespace App\Services\Scheduling;

use App\Models\Assignment;
use App\Models\Company;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ValidationResult;
use App\Support\TimeWindow;
use Illuminate\Support\Collection;

/**
 * "Esta semana hay 3 turnos que rompen el descanso."
 *
 * Los incumplimientos NO se guardan: se DERIVAN re-validando la ventana. Guardar
 * un incumplimiento sería peor que guardar un contador acumulado — un contador se
 * desincroniza cuando tocas SUS filas, pero un incumplimiento depende de OTRAS
 * filas (una baja nueva, un turno en la otra empresa, un perfil que cambia), así
 * que se volvería mentira sin que nadie lo hubiera tocado.
 *
 * Es más caro, sí. Pero es un informe, no la parrilla.
 *
 * Lo que SÍ está guardado es la decisión humana de forzar (assignment_overrides):
 * eso no se deduce de ninguna otra fila.
 */
class ViolationReport
{
    public function __construct(private AssignmentValidator $validator) {}

    /**
     * @return Collection<int, array{assignment: Assignment, result: ValidationResult}>
     */
    public function forCompany(Company $company, TimeWindow $window): Collection
    {
        return Assignment::query()
            ->where('company_id', $company->id)
            ->whereBetween('work_date', $window->toDateRange())
            ->with(['employment.profile', 'employment.company', 'position', 'override.user'])
            ->orderBy('work_date')
            ->orderBy('starts_at')
            ->get()
            ->map(fn (Assignment $assignment) => [
                'assignment' => $assignment,
                'result' => $this->validator->validate(AssignmentDraft::fromAssignment($assignment)),
            ])
            ->reject(fn (array $row) => $row['result']->isClean())
            ->values();
    }
}
