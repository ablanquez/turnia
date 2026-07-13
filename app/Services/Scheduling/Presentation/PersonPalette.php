<?php

namespace App\Services\Scheduling\Presentation;

use App\Models\Company;
use App\Models\Employment;

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
    /**
     * ⚠️ ESTOS DOCE COLORES ESTÁN CALCULADOS, NO ELEGIDOS A OJO. Y LOS QUINCE DE ANTES ERAN
     *    QUINCE VECES EL MISMO COLOR.
     *
     * La paleta anterior (#7F77DD, #5B8DEF, #9B6FD1, #6478C4…) era toda índigo, toda con la
     * MISMA luminosidad (L* 52–60) y el MISMO croma. En el zoom Día, con barras de 30 px y el
     * nombre escrito dentro, colaba. En la SEMANA, con barras de 10 px y sin texto, el relleno
     * es lo ÚNICO que dice de quién es la barra — y no lo decía:
     *
     *     Diego ≡ Sara    ΔE00  4,0        Ana   ≡ Nuria   ΔE00  6,6
     *     Diego ≡ Iker    ΔE00  6,1        Iker  ≡ Sara    ΔE00  7,2
     *     Diego ≡ Marco   ΔE00  6,2        Marco ≡ Sara    ΔE00  8,0
     *
     * Quince pares por debajo del umbral perceptible. La fila de Barra —Iker, Ana, Marco— eran
     * tres barras del mismo color. La ley 2 de la matriz visual ("el relleno dice de quién es:
     * tapa los nombres y todavía tienes que poder reconstruir quién hace qué") NO se cumplía.
     *
     * Y ningún test lo vio, porque todos comparaban COLORES CSS DECLARADOS. Y los quince eran
     * distintos… en el CSS. "Firma distinta" no es lo mismo que "se distingue".
     *
     * ESTOS SALEN DE UN CÁLCULO (tests/Visual/paleta.mjs): muestreo de punto más lejano en el
     * espacio Lab, maximizando el ΔE00 MÍNIMO entre cualquier par — que es la métrica que
     * importa, porque una paleta vale lo que valga su par más parecido.
     *
     *   · ΔE00 mínimo: 16,5   (antes: 4,0)
     *   · Luminosidad: L* 32 → 74   (antes: L* 52 → 60)
     *
     * Y ese segundo número es el que de verdad arregla la semana: a 10 px, la DIFERENCIA DE
     * LUMINOSIDAD es la única señal que el ojo conserva. Doce tonos igual de oscuros son un solo
     * tono, por mucho que el matiz cambie.
     *
     * SIGUE SIENDO UNA PALETA FRÍA, y por la misma razón de siempre: rojo, naranja, ámbar y
     * verde están reservados para el ESTADO. Si una persona pudiera salir en rojo, el rojo
     * dejaría de significar "imposible" y el encargado dejaría de mirarlo. El generador lo
     * impone: ningún color a menos de ΔE 28 de los cinco colores de estado.
     *
     * Y son DOCE y no quince a propósito: por debajo de ese matiz el ΔE mínimo cae en picado.
     * Doce colores que se distinguen valen más que quince que no.
     */
    private const COLORS = [
        '#14748A', // teal oscuro
        '#E662AE', // rosa
        '#5C4460', // ciruela oscuro
        '#9EB0F0', // azul claro
        '#14C2E4', // cian
        '#6E68C6', // índigo
        '#1492DE', // azul
        '#CEAAC6', // malva claro
        '#AA328A', // magenta oscuro
        '#1A5084', // azul marino
        '#927496', // gris violeta
        '#BC86EA', // lavanda
    ];

    /**
     * ⚠️ EL COLOR SE REPARTE, NO SE SORTEA. Y EL SORTEO REPETÍA COLORES DENTRO DE LA MISMA EMPRESA.
     *
     * Esto era `crc32(nombre) % N`. Suena inofensivo y es un fallo de raíz: un hash módulo N
     * COLISIONA, y colisionaba de verdad. En la demo, con la paleta vieja:
     *
     *     Bea Soler   → rgb(106, 118, 184)
     *     Tomás Vega  → rgb(106, 118, 184)     ← el MISMO color exacto
     *
     * Dos personas de la misma empresa con la misma barra. Y ninguna paleta arregla eso: por muy
     * separados que estén los colores, si a dos personas les toca el mismo, son el mismo.
     *
     * Ahora se REPARTE: se ordenan las personas de la empresa por id y se les da el color i % 12.
     * Determinista, estable (no depende de qué semana mires ni de quién tenga turno hoy), y sin
     * una sola colisión mientras la plantilla no pase de doce.
     *
     * Y a partir de doce, se repiten — porque no hay doce mil colores que se distingan. Eso no es
     * un fallo tapado: está en docs/PENDIENTES.md, y tests/Visual/pixeles.mjs lo DENUNCIA en
     * cuanto dos barras del mismo color caen en la misma vista. El día que la plantilla crezca,
     * el instrumento avisará; no lo descubriremos por una queja.
     *
     * @return array<int, string> person_id => color
     */
    public static function forCompany(Company $company): array
    {
        $ids = Employment::query()
            ->where('company_id', $company->id)
            ->distinct()
            ->orderBy('person_id')
            ->pluck('person_id');

        return $ids
            ->values()
            ->mapWithKeys(fn (int $id, int $i) => [$id => self::COLORS[$i % count(self::COLORS)]])
            ->all();
    }

    /**
     * El color de alguien que no tiene contrato en esta empresa (no debería pasar en la
     * parrilla, pero un color hay que dar). Estable por nombre, y por eso puede colisionar: es
     * el camino de emergencia, no el normal.
     */
    public static function fallback(string $name): string
    {
        return self::COLORS[crc32(mb_strtolower(trim($name))) % count(self::COLORS)];
    }

    /** "Ana López" -> "AL". Cabe donde no cabe el nombre. */
    public static function initials(string $firstName, string $lastName): string
    {
        return mb_strtoupper(mb_substr($firstName, 0, 1).mb_substr($lastName, 0, 1));
    }
}
