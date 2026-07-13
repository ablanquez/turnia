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
     *   · ΔE00 mínimo: 16,1   (antes: 4,0)
     *   · Luminosidad: L* 31 → 78   (antes: L* 52 → 60)
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
     * ═══════════════════════════════════════════════════════════════════════════════════════
     * ⚠️ Y ESTA QUINTA VERSIÓN CAMBIA LA GARANTÍA, QUE ES MÁS IMPORTANTE QUE CAMBIAR LOS COLORES.
     * ═══════════════════════════════════════════════════════════════════════════════════════
     *
     * Hasta aquí, la promesa era "los doce colores están separados entre sí". Y NO ES LA PROMESA
     * QUE HACE FALTA, porque una barra NUNCA es su color pelado: lleva encima una trama, pegado un
     * anillo, y en el zoom Día un alfa. Cada canal MUEVE el color. Con los doce a ΔE 13,8 unos de
     * otros, bastaba un empujón de 7 para que una barra cayera más cerca de OTRA PERSONA que de sí
     * misma — y la trama daba justo ese empujón.
     *
     * Ahora la paleta se calcula con una desigualdad triangular:
     *
     *     D = el ΔE mínimo entre dos personas cualesquiera.
     *     R = lo MÁS que una barra se aleja de su propio color, pintándose como se pinte.
     *
     *     Si R < D/2, la barra pintada está a ≥ D − R de cualquier otra persona y a R de la suya:
     *     GANA LA SUYA. Siempre. Para toda barra que exista y para las que todavía no.
     *
     *   · D = 16,1   (antes: 13,8)
     *   · R =  5,4   → 5,4 < 8,0 ✅  la ley 2 se cumple POR CONSTRUCCIÓN, no por suerte
     *   · Lo más cerca de una gravedad AJENA:  24,1   a CUALQUIER ancho de barra
     *   · Lo más cerca de la PISTA (#E7E5F0):  26,1   una barra tiene que verse sobre su fondo
     *   · Croma mínimo: 30 — por debajo, un color no tiene identidad y adopta la del vecino
     *
     * ⚠️ Y 16,1 ES EL TECHO, NO UNA MEDIA TINTA. Medido: en la zona fría —sin rojo, naranja, ámbar
     * ni verde, que son del estado— NO EXISTEN doce colores a ΔE 20 unos de otros. Ni ocho: el
     * máximo para ocho es 19,6. O sea que "todas las parejas holgadas" es IMPOSIBLE con el color
     * como único canal, y no por falta de esfuerzo.
     *
     * Por eso la identidad NUNCA cuelga solo del relleno: cada carril lleva su avatar con las
     * iniciales, su nombre escrito y una línea vertical de su color. El relleno es el canal que se
     * lee de un vistazo; no es el único que hay.
     *
     * ⚠️ ESTOS DOCE COLORES DEPENDEN DE LA GEOMETRÍA DE LA BARRA. No es una lista que se pueda
     * copiar y pegar: salen de un cálculo que TIENE DENTRO el alto (16 px), el grosor de cada
     * franja (2/3/4), la trama (2 px cada 8, en la sombra del propio color) y el fondo de la pista.
     * El día que cambie cualquiera de esos números, la paleta hay que VOLVER A GENERARLA
     * (`node tests/Visual/paleta.mjs`) — parchear un color a mano rompe la garantía, y la garantía
     * es lo único que impide que una barra vuelva a mentir.
     *
     * Y son DOCE: por encima, D cae (13 → 15,3 · 14 → 13,9). Doce que se distinguen valen más que
     * quince que no.
     */
    private const COLORS = [
        '#70D0CC', // turquesa claro
        '#0880A8', // teal
        '#38A0FC', // azul cielo
        '#989CFC', // periwinkle
        '#5844BC', // índigo
        '#840884', // magenta oscuro
        '#40CCFC', // cian
        '#08507C', // azul marino
        '#4470F0', // azul
        '#8074A8', // malva
        '#F890F8', // rosa claro
        '#C844B8', // magenta
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
