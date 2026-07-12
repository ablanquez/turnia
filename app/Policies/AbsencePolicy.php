<?php

namespace App\Policies;

use App\Models\Absence;
use App\Models\User;

/**
 * EL PUNTO MÁS SENSIBLE DE TURNIA.
 *
 * Una ausencia dice "Ana está de baja médica del 8 al 10". Es un dato de SALUD.
 * Un compañero de Ana no tiene ningún derecho a verlo, aunque los dos salgan en
 * el mismo cuadrante y aunque el hueco de Ana sea evidente.
 *
 * El empleado ve el cuadrante entero (es lo que se cuelga en la pared) pero de
 * las ausencias solo ve LAS SUYAS. Verá el hueco de Ana sin saber por qué, y eso
 * es exactamente lo correcto.
 */
class AbsencePolicy
{
    public function view(User $user, Absence $absence): bool
    {
        // La suya, siempre.
        if ($user->person_id !== null && $user->person_id === $absence->person_id) {
            return true;
        }

        // La de otro: solo quien gestiona la empresa donde está registrada.
        return $user->canManage($absence->company);
    }

    public function create(User $user, Absence $absence): bool
    {
        return $user->canManage($absence->company);
    }

    public function update(User $user, Absence $absence): bool
    {
        return $user->canManage($absence->company);
    }

    public function delete(User $user, Absence $absence): bool
    {
        return $user->canManage($absence->company);
    }
}
