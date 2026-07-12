<?php

namespace App\Policies;

use App\Models\Company;
use App\Models\User;

/**
 * Quién puede ver y quién puede tocar una empresa.
 *
 * No decide QUÉ PORCIÓN de los datos se ve: eso es cosa del alcance de la vista
 * (ScheduleScope). Aquí solo se decide si la puerta se abre.
 */
class CompanyPolicy
{
    /** Los tres papeles pueden abrir la empresa. Cualquier otro, no. */
    public function view(User $user, Company $company): bool
    {
        return $user->belongsToCompany($company);
    }

    /** Editar el cuadrante: dueño o encargado. El empleado solo mira. */
    public function manage(User $user, Company $company): bool
    {
        return $user->canManage($company);
    }

    /** Cambiar la empresa misma (perfiles, puestos, catálogos): solo el dueño. */
    public function update(User $user, Company $company): bool
    {
        return $user->owns($company);
    }

    public function delete(User $user, Company $company): bool
    {
        return $user->owns($company);
    }
}
