<?php

namespace App\Enums;

/**
 * Gravedad de una violación.
 *
 * Decisión de producto: el motor AVISA, no bloquea. Si la app impide forzar, el
 * encargado la cierra y coge el Excel.
 */
enum Severity: string
{
    /** Físicamente absurdo. La capa que escribe PUEDE bloquearlo. */
    case Impossible = 'impossible';

    /** Se incumple una condición del perfil o del convenio. Avisa, pero deja colocar. */
    case Breach = 'breach';

    /**
     * Ni imposible ni incumplimiento: algo que el encargado necesita SABER.
     *
     * El silencio no es lo mismo que "todo correcto".
     */
    case Notice = 'notice';
}
