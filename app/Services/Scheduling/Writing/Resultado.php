<?php

namespace App\Services\Scheduling\Writing;

/** Lo único que puede pasar al intentar escribir. Cuatro casos, y no hay un quinto. */
enum Resultado: string
{
    case Escrito = 'escrito';

    /** No se puede colocar. No se ha escrito nada, y se dice POR QUÉ. */
    case Imposible = 'imposible';

    /** Incumple. Se puede forzar, pero eso lo decide un humano — y queda constancia. */
    case NecesitaDecision = 'necesita_decision';

    case Quitado = 'quitado';
}
