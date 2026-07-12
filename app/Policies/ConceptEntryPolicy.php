<?php

namespace App\Policies;

use App\Models\ConceptEntry;
use App\Models\User;

/**
 * Un concepto horario es "hora médica", "permiso por enfermedad de un familiar",
 * "horas extra". Como la ausencia, es un dato personal que no le corresponde al
 * compañero de al lado.
 *
 * Mismo criterio que en AbsencePolicy: el empleado solo ve los suyos.
 */
class ConceptEntryPolicy
{
    public function view(User $user, ConceptEntry $entry): bool
    {
        if ($user->person_id !== null && $user->person_id === $entry->person_id) {
            return true;
        }

        return $user->canManage($entry->company);
    }

    public function create(User $user, ConceptEntry $entry): bool
    {
        return $user->canManage($entry->company);
    }

    public function update(User $user, ConceptEntry $entry): bool
    {
        return $user->canManage($entry->company);
    }

    public function delete(User $user, ConceptEntry $entry): bool
    {
        return $user->canManage($entry->company);
    }
}
