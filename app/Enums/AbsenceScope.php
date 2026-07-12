<?php

namespace App\Enums;

/**
 * A quién afecta una ausencia.
 *
 * Una baja laboral es de la persona: el tobillo roto no distingue de empresas.
 * Unas vacaciones son del contrato: se pueden coger en una empresa y no en otra.
 */
enum AbsenceScope: string
{
    /** Afecta a todos los contratos de la persona. */
    case Person = 'person';

    /** Afecta solo al contrato indicado. */
    case Employment = 'employment';
}
