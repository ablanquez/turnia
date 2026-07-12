<?php

namespace App\Policies;

use App\Models\Assignment;
use App\Models\User;

/**
 * El turno SÍ es del cuadrante.
 *
 * A diferencia de las bajas y los conceptos, quién está de barra el sábado es
 * información operativa: se cuelga en la pared del bar y todo el equipo la ve.
 * El empleado ve los turnos de sus compañeros dentro de su empresa.
 *
 * Lo que NO ve es un turno de OTRA empresa, aunque sea de la misma persona.
 */
class AssignmentPolicy
{
    public function view(User $user, Assignment $assignment): bool
    {
        return $user->belongsToCompany($assignment->company);
    }

    public function create(User $user, Assignment $assignment): bool
    {
        return $user->canManage($assignment->company);
    }

    public function update(User $user, Assignment $assignment): bool
    {
        return $user->canManage($assignment->company);
    }

    public function delete(User $user, Assignment $assignment): bool
    {
        return $user->canManage($assignment->company);
    }
}
