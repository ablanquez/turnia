<?php

namespace App\Services\Scheduling\Validation;

/** Una regla sobre un CONCEPTO HORARIO (hora médica, permiso, hora extra). */
interface ConceptRule
{
    /** @return array<int, Violation> */
    public function check(ConceptEntryDraft $draft): array;
}
