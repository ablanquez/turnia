<?php

namespace App\Enums;

/**
 * Tipo de jornada que permite un perfil.
 *
 * Una jornada partida no se declara: son dos asignaciones el mismo día.
 * Este valor solo dice si el perfil la admite.
 */
enum WorkdayType: string
{
    /** Solo jornada continua: una única asignación por día. */
    case Continuous = 'continuous';

    /** Solo jornada partida: exige más de una asignación por día. */
    case Split = 'split';

    /** Sin restricción. */
    case Any = 'any';
}
