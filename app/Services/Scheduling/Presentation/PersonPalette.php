<?php

namespace App\Services\Scheduling\Presentation;

/**
 * El color de cada persona, y por qué la paleta es FRÍA.
 *
 * Rojo, ámbar y verde están reservados para el estado (imposible, aviso,
 * correcto). Si una persona pudiera salir en rojo, el rojo dejaría de significar
 * "imposible" y el encargado dejaría de mirarlo. Por eso aquí solo hay azules,
 * índigos, violetas y ciruelas.
 *
 * El color es ESTABLE: se deriva del id, así que la misma persona sale del mismo
 * color en la parrilla y en el panel de plantilla, hoy y dentro de un año.
 */
final class PersonPalette
{
    private const COLORS = [
        '#7F77DD', '#5B8DEF', '#9B6FD1', '#6478C4', '#A86BB0',
        '#5E86C9', '#8A6FC7', '#6A76B8', '#7E6FB0', '#A06BB0',
        '#4E7FD1', '#7A73C9', '#5566B8', '#9166C0', '#6C74C6',
    ];

    /**
     * El color se deriva del NOMBRE, no del id.
     *
     * Del id sería igual de estable, pero cambiaría al recrear la base de datos: la demo
     * saldría de otro color cada vez que se resiembra, y las capturas de referencia dejarían
     * de servir. Del nombre, Ana es del mismo color hoy, mañana y en otra instalación.
     */
    public static function for(string $name): string
    {
        $hash = crc32(mb_strtolower(trim($name)));

        return self::COLORS[$hash % count(self::COLORS)];
    }

    /** "Ana López" -> "AL". Cabe donde no cabe el nombre. */
    public static function initials(string $firstName, string $lastName): string
    {
        return mb_strtoupper(mb_substr($firstName, 0, 1).mb_substr($lastName, 0, 1));
    }
}
