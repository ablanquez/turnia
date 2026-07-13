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
     * dejaría de significar "imposible" y el encargado dejaría de mirarlo.
     *
     * ⚠️ Y EL CRITERIO DE "NO PARECERSE A UN ESTADO" ERA EL EQUIVOCADO. ESTA ES LA TERCERA VERSIÓN.
     *
     * La segunda paleta (#14748A, #5C4460, #927496…) cumplía "ningún color a menos de ΔE 28 de un
     * color de estado" — los doce, con holgura, el peor a 29,6. Y la barra de Marco se veía
     * MARRÓN igual, y el usuario la leyó como un incumplimiento.
     *
     * ¿Por qué? Porque ese ΔE compara DOS PARCHES AISLADOS, y en una parrilla nada está aislado.
     * Una barra lleva PEGADA su marca de gravedad, y el ojo integra las dos. Medido:
     *
     *     #5C4460 (ciruela apagado) + ámbar  →  #855F3E   marrón, a ΔE 10 de la tinta de aviso
     *     #14748A (teal)            + ámbar  →  #5A7C57   VERDE, a ΔE 10 del verde de COBERTURA
     *
     * Un aviso pintado del color de "todo bien". Y la causa de fondo es el CROMA: por debajo de
     * C≈30 un color no tiene identidad propia y adopta la del vecino. Los dos culpables tenían
     * C 22 y C 20.
     *
     * Así que el generador (tests/Visual/paleta.mjs) mide ahora LO QUE SE VE —la barra CON su
     * anillo— y exige que siga pareciéndose más a SU PERSONA que a cualquier estado (margen ≥ 8).
     * Eso obliga a C ≥ 30, y de paso deja fuera toda la zona de barro.
     *
     * Y el criterio final, después de tres intentos, es un UMBRAL ABSOLUTO:
     *
     *     NINGUNA BARRA PUEDE QUEDAR A MENOS DE ΔE 20 DE UNA GRAVEDAD QUE NO ES LA SUYA.
     *
     * Absoluto y no relativo, porque el relativo acusaba a un inocente: una barra teal con anillo
     * rojo queda a ΔE 29,6 del naranja —lejísimos— pero también lejos del teal, y el "margen"
     * salía negativo. El umbral absoluto caza los tres casos REALES (el marrón de Marco a ΔE 11,
     * el verde de Iker a 10,2, un magenta que con anillo naranja se vuelve rojo a 17,2) y no
     * acusa al que no.
     *
     * ⚠️ Y LA VERSIÓN ANTERIOR TENÍA UN AGUJERO QUE SOLO SE VIO AL PENSAR EN EL RESPONSIVE.
     *
     * El generador metía "el ancho de una barra" como si fuera UNO: 50 px, el de un turno de ocho
     * horas. Y el peso del anillo depende del ancho, así que la paleta SOLO FUNCIONABA A ESE ANCHO.
     * Medido sobre la imagen, con un turno de UNA hora (5 px de barra), el anillo pesaba el 67 % y
     * el peor color quedaba a ΔE 5,8 de una gravedad ajena: un aviso ámbar sobre un púrpura oscuro
     * se veía MARRÓN. El bug de Marco, reencarnado — y ni la demo ni los 96 casos del cuadrante lo
     * habrían enseñado nunca, porque TODOS usan turnos de ocho horas.
     *
     * La solución no fue otra paleta: fue que EL ANILLO DEJE DE RODEAR. Dos franjas, arriba y
     * abajo, cuyo peso es 2w/(alto+2w) y NO DEPENDE DEL ANCHO. Ver useMatrizVisual.js.
     *
     *   · ΔE00 mínimo entre personas:            13,8
     *   · Croma mínimo:                          30    (antes: 20)
     *   · Lo más cerca de una gravedad AJENA:    24,1  a CUALQUIER ancho de barra
     *
     * ⚠️ ESTOS DOCE COLORES DEPENDEN DE LA GEOMETRÍA DE LA BARRA. No es una lista que se pueda
     * copiar y pegar: salen de un cálculo que TIENE DENTRO el alto (16 px), el grosor de cada
     * franja (2/3/4) y hasta la trama del imposible. El día que cambie cualquiera de esos números,
     * la paleta hay que VOLVER A GENERARLA — parchear un color a mano rompe la garantía, y la
     * garantía es lo único que impide que una barra vuelva a mentir.
     *
     * Y son DOCE: por encima, el ΔE mínimo cae en picado. Doce que se distinguen valen más que
     * quince que no.
     */
    private const COLORS = [
        '#1480B4', // azul
        '#E06EC6', // rosa
        '#623884', // púrpura oscuro
        '#A4B0F0', // azul claro
        '#56C2D2', // turquesa
        '#7474A8', // añil grisáceo
        '#1A5096', // azul marino
        '#A456B4', // orquídea
        '#56B0F0', // azul cielo
        '#AA80EA', // violeta
        '#6286F0', // añil
        '#C8A4D8', // lavanda
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
