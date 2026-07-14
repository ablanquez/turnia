<?php

namespace App\Services\Scheduling\Writing;

use App\Models\Assignment;

/**
 * LO QUE EL CANDADO DECIDIÓ. Y las violaciones que lleva dentro son LAS QUE SE VIERON
 * DENTRO DEL CANDADO — nunca las que se le enseñaron al usuario en pantalla.
 *
 * Esa distinción es la tanda entera. Lo que se pinta al arrastrar es una PREVISUALIZACIÓN;
 * lo que decide es esto.
 */
final readonly class Decision
{
    private function __construct(
        public Resultado $resultado,
        public ?Assignment $assignment,
        /** @var array<int, array<string, mixed>> tal como las vio el candado */
        public array $violations,
        /** Se escribió forzando: hay constancia en assignment_overrides. */
        public bool $forzado = false,
        /**
         * ⚠️ EL ESTADO CAMBIÓ ENTRE QUE SE LE PREGUNTÓ Y QUE CONTESTÓ, Y HAY QUE DECÍRSELO.
         *
         * El usuario justificó forzar UNA cosa. Si al entrar en el candado resulta que ya no
         * incumple —o que incumple OTRA regla distinta—, su justificación no vale para lo que
         * hay ahora. Callarlo sería estamparle una firma sobre un contrato que no leyó.
         */
        public bool $cambioElEstado = false,
    ) {}

    public static function escrito(Assignment $assignment, bool $forzado = false, bool $cambio = false): self
    {
        return new self(Resultado::Escrito, $assignment, [], $forzado, $cambio);
    }

    /** @param  array<int, array<string, mixed>>  $violations */
    public static function imposible(array $violations): self
    {
        return new self(Resultado::Imposible, null, $violations);
    }

    /**
     * Incumple, y NO se ha escrito: hace falta que un humano decida si lo fuerza.
     *
     * `$cambio` = ya venía una justificación, pero para OTRA cosa. Se le vuelve a preguntar,
     * con los motivos nuevos.
     *
     * @param  array<int, array<string, mixed>>  $violations
     */
    public static function necesitaDecision(array $violations, bool $cambio = false): self
    {
        return new self(Resultado::NecesitaDecision, null, $violations, false, $cambio);
    }

    public static function quitado(): self
    {
        return new self(Resultado::Quitado, null, []);
    }
}
