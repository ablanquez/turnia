<?php

namespace App\Services\Scheduling;

use App\Services\Scheduling\Validation\ValidationResult;
use Illuminate\Database\Eloquent\Model;

/**
 * Una fila del informe: QUÉ incumple y QUÉ le pasa.
 *
 * El sujeto puede ser una asignación, un concepto horario o una ausencia. El informe
 * tiene que mirarlos a los TRES: el motor sabe validar los tres, y lo que el motor
 * sabe validar y nadie re-valida es un silencio falso esperando a ocurrir.
 */
final readonly class ReportedViolation
{
    public function __construct(
        public string $kind,      // assignment | concept_entry | absence
        public Model $subject,
        public ValidationResult $result,
    ) {}
}
