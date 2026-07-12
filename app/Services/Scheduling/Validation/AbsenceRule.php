<?php

namespace App\Services\Scheduling\Validation;

/** Una regla sobre una AUSENCIA (baja, vacaciones, permiso largo). */
interface AbsenceRule
{
    /** @return array<int, Violation> */
    public function check(AbsenceDraft $draft): array;
}
