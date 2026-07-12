<?php

namespace App\Policies;

use App\Models\Calendar;
use App\Models\User;

/**
 * El calendario no tiene permisos propios: hereda los de su empresa.
 *
 * Existe para que la ruta pueda autorizar directamente sobre lo que le llega por
 * route model binding, sin que el controlador tenga que ir a buscar la empresa a
 * mano (y sin que se pueda olvidar de hacerlo).
 */
class CalendarPolicy
{
    public function view(User $user, Calendar $calendar): bool
    {
        return $user->belongsToCompany($calendar->company);
    }

    public function manage(User $user, Calendar $calendar): bool
    {
        return $user->canManage($calendar->company);
    }
}
