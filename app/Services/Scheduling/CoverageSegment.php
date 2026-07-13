<?php

namespace App\Services\Scheduling;

use App\Models\Position;
use Carbon\CarbonImmutable;

/**
 * Un tramo de tiempo con su demanda y su cobertura real.
 *
 * "De 12:00 a 14:00 hacen falta 3 de barra y hay 1: faltan 2."
 *
 * El día se parte por los bordes de los turnos y de los requisitos, y cada tramo se
 * evalúa por separado. Es más caro que mirar la franja entera, pero es lo único que
 * no miente: un turno de 12 a 14 no cubre una franja de 12 a 16, y decir que faltan
 * 3 en toda la tarde sería un aviso falso — el veneno que ya conocemos.
 */
final readonly class CoverageSegment
{
    public function __construct(
        public Position $position,
        public CarbonImmutable $workDate,
        public CarbonImmutable $startsAt,
        public CarbonImmutable $endsAt,
        public int $required,
        public int $covered,
        /**
         * ⚠️ HAY DOS CEROS DISTINTOS, Y CONFUNDIRLOS ES UN SILENCIO FALSO.
         *
         * `required = 0` puede significar dos cosas OPUESTAS:
         *
         *   · CERRADO: alguien declaró un requisito de CERO personas ese día ("el 25 de
         *     diciembre la barra no abre"). Es una demanda, y dice "no quiero a nadie aquí".
         *     Si pones a alguien, ESO SÍ ES UN EXCESO — y de los caros: estás pagando una
         *     jornada un día que el negocio cierra.
         *
         *   · FUERA DE FRANJA: no hay ningún requisito que cubra ese tramo. Nadie ha dicho
         *     nada. Un turno de 10 a 18 contra una demanda declarada solo de 12 a 16 deja los
         *     bordes (10–12 y 16–18) sin demanda de ninguna clase. Ahí NO sobra nadie: es que
         *     no se pide a nadie.
         *
         * Sin este campo los dos casos daban `excess` y pintaban el mismo "+1" índigo. Y al
         * arreglarlo a lo bruto —tratando todo `required = 0` como "no se pide"— me cargué el
         * aviso del día cerrado, que es el más caro de los dos. Lo cazó un test que ya existía.
         */
        public bool $demanded = true,
    ) {}

    /** Cuánta gente falta. Cero si está cubierto o sobra. */
    public function missing(): int
    {
        return max(0, $this->required - $this->covered);
    }

    /** Cuánta gente sobra. También es información útil. */
    public function excess(): int
    {
        return max(0, $this->covered - $this->required);
    }

    public function isGap(): bool
    {
        return $this->missing() > 0;
    }

    /**
     * Sobra gente SOBRE UNA DEMANDA DECLARADA. Sin demanda no sobra nadie: no se pidió.
     *
     * Ojo: un día CERRADO (requisito declarado de cero) sí tiene demanda, y por eso poner a
     * alguien ahí sigue saliendo como exceso. Ver el comentario de $demanded.
     */
    public function isExcess(): bool
    {
        return $this->demanded && $this->excess() > 0;
    }

    /**
     * AQUÍ NO SE PIDE A NADIE, Y NADIE LO HA DICHO: no hay requisito que cubra este tramo.
     *
     * No es "correcto" (no hay nada que cubrir) y no es "exceso" (no sobra nadie sobre nada).
     * Es su propio estado, y se pinta neutro y sin número. Ver el comentario de $demanded.
     */
    public function isUnrequested(): bool
    {
        return ! $this->demanded;
    }

    /** Ni cubierto ni ignorado: exactamente la gente que se pedía. Es el verde. */
    public function isCovered(): bool
    {
        return $this->demanded && $this->required > 0 && $this->required === $this->covered;
    }

    /**
     * El estado del tramo, en una palabra.
     *
     * Vive aquí y no en la vista porque es la MISMA pregunta que se hace el informe, y dos
     * respuestas distintas a la misma pregunta acaban divergiendo.
     *
     * ⚠️ NO HAY RAMA `default` QUE CAIGA EN VERDE. La había, y era una bomba de relojería: un
     * tramo sin demanda y sin nadie devolvía 'covered' —o sea, CORRECTO— porque no encajaba en
     * ningún otro caso. Hoy el calculador descarta ese tramo antes de emitirlo, así que no
     * llegaba a la vista; pero el día que dejara de descartarlo, la parrilla habría anunciado
     * en verde un puesto donde no hay ni demanda ni gente. El verde se GANA.
     */
    public function state(): string
    {
        return match (true) {
            $this->isUnrequested() => 'unrequested',
            $this->isGap() => 'missing',
            $this->isExcess() => 'excess',
            $this->isCovered() => 'covered',
            default => 'unrequested',
        };
    }
}
