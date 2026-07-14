<script setup>
import { computed, inject, ref } from 'vue';
import { BRAND_DARK, severityColor, severityIcon, worst } from '../../composables/useSeverity.js';
import { ANILLO_MAX, agruparNotas, pintarBloque, tintaSobre, violacionesDe } from '../../composables/useMatrizVisual.js';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * LA BARRA SE PUEDE COGER, Y SE PUEDE QUITAR CON Supr.
 *
 * ⚠️ Y SI EL QUE MIRA NO PUEDE EDITAR, ESTO ES `null` Y AQUÍ NO PASA NADA. La rejilla no lo provee
 * (ver WeekGrid): un empleado no arrastra nada, y no porque se le esconda el botón — porque el
 * gesto no existe para él. La Policy lo vuelve a decir en el servidor, que es donde manda.
 */
const edicion = inject('edicion', null);

const editable = computed(() => !! edicion);

/**
 * ⚠️ SOLO SE COGEN LOS TURNOS. Un concepto (una hora médica, una hora extra) NO se arrastra.
 *
 * No es una limitación: es que editar conceptos y ausencias es OTRA tanda, con sus propias reglas
 * (un concepto cuelga de un catálogo, una baja consume cupo). Dejar que se arrastraran «porque
 * están ahí» sería escribir una tabla con las reglas de otra.
 */
const arrastrable = (p) => editable.value && p.block.kind === 'shift';

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ UN TURNO DE UNA HORA MIDE **5 PÍXELES**. AGARRAR ESO CON EL RATÓN ES UNA LOTERÍA.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Y la salida fácil —«que se pueda coger el carril entero»— ESTÁ MAL, y está mal por una razón que
 * es la de siempre en este proyecto:
 *
 *     LO QUE SE ARRASTRA ES **UN TURNO**, NO UNA PERSONA.
 *
 * Lucía tiene 09:00–13:00 y 17:00–21:00. Si al pasar el ratón se iluminara TODO su carril, la
 * pregunta «¿cuál de los dos voy a mover?» no tendría respuesta en la pantalla. Un asidero que no
 * dice qué agarra es peor que un asidero pequeño: el pequeño falla, el ambiguo ACIERTA MAL.
 *
 * LA SALIDA ES AMPLIAR EL ASIDERO SIN AMPLIAR LA BARRA:
 *
 *   · EL RÓTULO DE ESE TURNO TAMBIÉN AGARRA. Y el rótulo mide ~100 px de ancho. Como cada barra
 *     tiene YA su propio rótulo (ley 8: cada turno lleva su hora), cada rótulo agarra SU barra. Sin
 *     ambigüedad, y sin inventarse nada nuevo en la pantalla.
 *   · AL PASAR EL RATÓN, LA BARRA Y SU RÓTULO SE RESALTAN **JUNTOS**. Eso es lo que contesta a
 *     «¿cuál de los dos?» antes de pulsar, no después.
 *   · Y la barra lleva un margen de agarre invisible ARRIBA Y ABAJO (ver `data-t="agarre"`).
 */
const encima = ref(null);

const señalar = (p) => {
    if (arrastrable(p)) {
        encima.value = p.key;
    }
};

const soltarSeñal = () => {
    encima.value = null;
};

const resaltado = (p) => encima.value === p.key;

const coger = (e, p) => {
    if (! arrastrable(p)) {
        return;
    }

    edicion.cogerBarra(e, { assignment: p.block, person: props.person });
};

/**
 * ⚠️ LA PERSONA VA EN LA LLAMADA, Y NO SOBRA: SIN ELLA EL AVISO DECÍA «EL TURNO QUITADO DE BARRA».
 *
 * Sin sujeto. En la única operación DESTRUCTIVA que tiene la aplicación, y en el aviso que lleva el
 * botón de deshacer. Quitar por la papelera sí decía el nombre (el arrastre lleva la persona en la
 * carga); quitar con Supr, no — el mismo hecho contado de dos maneras, según el gesto. Ley 8.
 */
const supr = (p) => {
    if (arrastrable(p)) {
        edicion.quitar(p.block, props.person);
    }
};

/**
 * UN CARRIL: una persona, dentro de un puesto, dentro de un día.
 *
 * ⚠️ ESTE COMPONENTE NO DECIDE NI UN SOLO COLOR. Los pide (useMatrizVisual) y los pinta.
 *
 * Durante siete tandas cada componente decidía su rojo sobre la marcha, y por eso cada tanda
 * aparecía un caso nuevo mal pintado. La representación vive ahora en UN sitio, y este fichero
 * solo hace lo que sabe hacer: colocar cosas en el eje X y apilarlas cuando se pisan.
 *
 * EL TIEMPO ES EL EJE X. Las barras se posicionan por su hora real, así que:
 *   · la jornada partida se VE como dos barras con un agujero físico en medio
 *   · el turno nocturno se VE cruzando el borde del día
 *   · el solape se VE como dos barras pisándose
 * Se ve. No hay que leerlo.
 *
 * ⚠️ Y NADA SE TRUNCA. NUNCA. NI EL NOMBRE NI LA HORA.
 */
const props = defineProps({
    person: { type: Object, required: true },
    // Turnos Y conceptos horarios de esta persona ese día: los dos la ocupan físicamente, y
    // por eso van en el mismo carril. Así se VE que la hora médica de las 10 cae dentro del
    // turno de 9 a 17, en vez de haber que buscarla en otra fila.
    blocks: { type: Array, required: true },
    axis: { type: Object, required: true },
    // El informe entero (assignments + conceptEntries), o null mientras no ha llegado.
    // null NO significa "sin incidencias".
    violations: { type: Object, default: null },
    // Las gravedades que la CELDA ya grita en un cartel, arriba. El carril no las repite.
    gritadas: { type: Set, default: null },
});

/**
 * ⚠️ 16 px, Y CADA UNO DE LOS DIECISÉIS ES DE LA PERSONA. Antes eran 8, luego 10, luego 12.
 *
 * Y las tres veces la respuesta ha sido la MISMA, que es lo que la convierte en una lección y no
 * en un ajuste: DOS PREGUNTAS PELEÁNDOSE POR EL MISMO SITIO SE ARREGLAN DÁNDOLES MÁS SITIO.
 *
 * Con la gravedad pintada como BORDE, 2 px arriba y 2 abajo se comían el 40 % de la barra y el
 * relleno salía MEZCLADO: el teal de Iker con un aviso ámbar daba un VERDE a ΔE 10 del verde de
 * "cobertura correcta". Se sacó el anillo FUERA (outline) y el relleno volvió a ser entero.
 *
 * Pero el anillo sigue pesando 2w/(ALTO + 2w) de lo que el ojo integra, así que ALTO es el
 * parámetro que REPARTE EL SITIO entre los dos canales. Y hubo que engordar el anillo del
 * incumplimiento —a 2 px se leía como un borde, no como una alarma—, lo que obligó a repartir
 * otra vez:
 *
 *     barra de 12 px, anillos 2/3/3  →  ΔE mínimo entre personas 11,5   ❌ el ojo no distingue
 *     barra de 14 px, anillos 2/3/3  →  ΔE mínimo 14,4  ✅ pero el imposible pierde su gradación
 *     barra de 16 px, anillos 2/3/4  →  ΔE mínimo 15,8  ✅ y el imposible sigue siendo el más gordo
 *
 */
const ALTO = 16;

/**
 * ⚠️ EL HUECO Y EL AIRE SE DERIVAN DEL ANILLO. NO SE ESCRIBEN.
 *
 * Estaban a 9 y a 4, que son los valores correctos… PARA UN ANILLO DE 4 px. Y eso los convierte en
 * constantes escondidas: números que solo son ciertos en el caso en que nacieron. El día que el
 * imposible engordase a 5, el aire se quedaría corto (la pista lleva overflow-hidden y le
 * RECORTARÍA la alarma por arriba y por abajo) y el hueco también (los anillos de dos barras que se
 * pisan se TOCARÍAN, y el solape dejaría de verse como solape). Los dos fallos, en silencio.
 *
 *   AIRE  = el anillo más gordo → el anillo cabe entero, justo.
 *   HUECO = dos anillos + 1 px  → entre dos barras encimadas siempre queda una raya de pista.
 */
const HUECO = 2 * ANILLO_MAX + 1;

/**
 * EL REPARTO EN SUB-CARRILES ES GEOMÉTRICO Y NO JUZGA NADA:
 *
 *   · si dos bloques SE PISAN  → sub-carriles distintos → se ven encimados → IMPOSIBLE
 *   · si entre ellos hay AIRE  → el mismo sub-carril    → hueco físico     → PARTIDA
 *
 * Quien decide cuál es cuál es el motor. Aquí solo se pinta lo que hay, y lo que hay se ve.
 */
const repartidos = computed(() => {
    const orden = props.blocks.slice().sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);
    const finDeSubcarril = [];

    for (const bloque of orden) {
        let i = finDeSubcarril.findIndex((fin) => bloque.startHour >= fin);

        if (i === -1) {
            i = finDeSubcarril.length;
            finDeSubcarril.push(0);
        }

        finDeSubcarril[i] = bloque.endHour;
        bloque.subcarril = i;
    }

    return { bloques: orden, subcarriles: Math.max(1, finDeSubcarril.length) };
});

/**
 * ⚠️ EL AIRE DE ARRIBA Y DE ABAJO NO ES ESTÉTICA: ES EL SITIO DEL ANILLO.
 *
 * La pista lleva overflow-hidden —si no, una barra se saldría de su carril—, y el anillo de
 * gravedad vive FUERA de la barra. Sin estos 3 px, el anillo rojo del imposible se recortaría
 * justo por arriba y por abajo, que es donde más se ve. La barra saldría con media alarma.
 *
 * Y el `padding` no sirve aquí: un hijo posicionado en absoluto se coloca contra la caja de
 * relleno, así que el padding NO lo desplaza. Hay que sumarlo al `top` a mano.
 *
 * ⚠️ Y LLEVA 4 px MÁS: EL SITIO DE LA SOMBRA DEL HOVER.
 *
 * La pista recorta lo que se sale (`overflow-hidden`), así que sin este margen la sombra que dice
 * «esta es la barra que vas a coger» aparecería MEDIO CORTADA justo por arriba y por abajo — que es
 * donde se ve. Es la misma lección del anillo, otra vez: si un canal vive fuera de la barra, hay que
 * darle el sitio, o el recorte se lo come en silencio.
 *
 * (Esto NO toca la paleta: AIRE y HUECO no cambian ni un píxel DENTRO de la barra, y la paleta se
 * calcula sobre el alto, las franjas, la trama y el fondo de la pista. Ver la ley 16.)
 */
const AIRE = ANILLO_MAX + 4;

const altoPista = computed(() => {
    const n = repartidos.value.subcarriles;

    return n * ALTO + (n - 1) * HUECO + AIRE * 2;
});

/** Lo que la matriz dice de cada bloque. Una sola llamada, y de ahí sale TODO lo que se pinta. */
const pintados = computed(() => repartidos.value.bloques.map((block) => ({
    key: `${block.kind}-${block.id}`,
    block,
    ...pintarBloque(block, {
        person: props.person,
        violations: props.violations,
        gritadas: props.gritadas,
    }),
})));

/** La gravedad del carril entero: la peor de todo lo que hay dentro. Turnos Y conceptos. */
const laneSeverity = computed(() => worst(
    props.blocks.flatMap((b) => violacionesDe(b, props.violations)),
));

const tambienEnOtraEmpresa = computed(() => props.blocks
    .flatMap((b) => violacionesDe(b, props.violations))
    .some((v) => v.code === 'shared_workday'));

/**
 * Las notas del carril, con las del MISMO MOTIVO agrupadas (ley 17).
 *
 * El filtro por texto que había aquí solo quitaba duplicados EXACTOS —misma hora y mismo motivo—,
 * así que los dos turnos de Marco, con el mismo aviso y horas distintas, salían dos veces.
 */
const notas = computed(() => agruparNotas(pintados.value.flatMap((p) => p.notas)));

/**
 * ⚠️ EL RESALTADO DEL HOVER NO PUEDE USAR NINGÚN CANAL DE LA MATRIZ, Y NO LO USA.
 *
 * Relleno (identidad), densidad (cuánto cuenta), anillo (gravedad), borde (turno/concepto), muesca
 * (forzado) y filo (medianoche) están todos ocupados. Tocar cualquiera de ellos para decir «tienes
 * el ratón encima» sería inventarse un séptimo significado dentro de un canal que ya tiene uno.
 *
 * Se usa una SOMBRA PROYECTADA, difuminada y con desplazamiento. No se confunde con el anillo —que
 * son dos franjas nítidas, sin desenfoque— y dice justo lo que hay que decir: «esta barra está
 * levantada, se puede coger». Es el mismo lenguaje que el fantasma.
 *
 * ⚠️ Y LA BARRA NO SE MUEVE NI UN PÍXEL. Su posición es el EJE DEL TIEMPO: levantarla, agrandarla o
 * desplazarla para «darle vidilla» sería mentir sobre la hora a la que empieza.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠️⚠️ Y ESTO CASI BORRA LA ALARMA. LO CAZÓ EL INSTRUMENTO, NO YO.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * EL ANILLO DE GRAVEDAD **ES UN `box-shadow`** (dos franjas, arriba y abajo — ver `anilloDe`). La
 * primera versión de esto ponía `boxShadow: SOMBRA_HOVER` en el objeto de estilo, DESPUÉS de
 * `...p.relleno`. En JavaScript eso no compone: **SOBRESCRIBE**.
 *
 *     Resultado: pasar el ratón por encima de un turno IMPOSIBLE **le borraba el anillo rojo**.
 *
 * Un silencio falso, en el canal más importante que tiene la aplicación, causado por un efecto de
 * ratón. Y no se ve leyendo el código: se ve porque `arrastrar.mjs` contó DOS barras con sombra
 * donde debía haber una, y al ir a mirar por qué, la razón era esta.
 *
 * Por eso el hover **se concatena** con lo que ya hubiera. Y el anillo va PRIMERO: en una lista de
 * sombras, la primera se pinta encima.
 */
const SOMBRA_HOVER = '0 3px 9px -1px rgb(30 26 60 / 60%)';

const barraStyle = (p) => {
    const base = {
        ...p.relleno,
        position: 'absolute',
        left: `${p.block.left}%`,
        width: `${p.block.width}%`,
        top: `${AIRE + (p.block.subcarril ?? 0) * (ALTO + HUECO)}px`,
        height: `${ALTO}px`,
        // Un turno de media hora sigue siendo un turno: por estrecho que sea, se ve.
        minWidth: '3px',
        borderRadius: '3px',
    };

    if (! resaltado(p)) {
        return base;
    }

    return {
        ...base,
        boxShadow: base.boxShadow ? `${base.boxShadow}, ${SOMBRA_HOVER}` : SOMBRA_HOVER,
        zIndex: 2,
    };
};

/** La muestra del rótulo usa EXACTAMENTE el mismo relleno que su barra. Por eso se emparejan. */
const muestraStyle = (p) => ({
    ...p.muestra,
    width: '10px',
    height: '7px',
    borderRadius: '2px',
    flexShrink: 0,
});

/** El tooltip: aquí SÍ va todo, sin recortar. Se pide, no se impone. */
const title = computed(() => {
    const partes = [`${props.person.name} · ${pintados.value.map((p) => p.rotulo.hora).join('   ·   ')}`];

    for (const block of props.blocks) {
        for (const v of violacionesDe(block, props.violations)) {
            partes.push(v.message);
        }
    }

    return partes.join('\n');
});
</script>

<template>
    <div data-t="carril" :data-persona="person.name" :title="title">
        <div class="flex items-start gap-1.5">
            <span class="relative mt-px flex shrink-0">
                <span
                    data-t="avatar"
                    :data-persona="person.name"
                    class="tabular flex h-4 w-4 items-center justify-center rounded-full text-[7.5px] font-semibold"
                    :style="{ background: person.color, color: tintaSobre(person.color) }"
                >{{ person.initials }}</span>

                <!-- Punto ámbar: ese día también trabaja en otro sitio. Se ve sin leer nada. -->
                <span
                    v-if="tambienEnOtraEmpresa"
                    class="absolute -right-0.5 -top-0.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-white bg-notice"
                />
            </span>

            <!-- El nombre NO se trunca. Nunca. Si no cabe, ENVUELVE. -->
            <span
                data-t="nombre"
                class="min-w-0 flex-1 break-words text-[12px] font-semibold leading-tight text-ink"
            >{{ person.name }}</span>

            <span
                v-if="laneSeverity"
                class="ml-0.5 shrink-0 text-[11px] leading-none"
                :style="{ color: severityColor(laneSeverity) }"
            >{{ severityIcon(laneSeverity) }}</span>
        </div>

        <!--
            TODO LO DE UNA PERSONA CUELGA DE UNA LÍNEA DE SU COLOR. Y ESO NO ES DECORACIÓN.

            Al dar una línea a cada barra, el carril PERDIÓ EL AGRUPAMIENTO: los rótulos quedaron
            flotando y había que deducir de quién eran POR PROXIMIDAD. En una parrilla que existe
            para saber QUIÉN está CUÁNDO, un horario sin dueño no es información: es un acertijo.
        -->
        <div class="ml-[7px] mt-[3px] border-l-2 pl-[9px]" :style="{ borderColor: person.color }">
            <!--
                ⚠️ EL RÓTULO ES UN ASIDERO. Y por eso el turno de una hora se puede coger.

                La barra mide 5 px de ancho; esto mide 100. Y agarra EXACTAMENTE su barra —no el
                carril, no la persona— porque cada turno tiene su propio rótulo con su propia hora.

                Se resalta a la vez que su barra (fondo índigo claro + la sombra de allí): antes de
                pulsar ya se ve CUÁL de los dos turnos de Lucía se va a mover.

                ⚠️ El atributo es `data-rotulo-de`, y **NO** `data-assignment-id`. Casi me cuesta el
                instrumento: `arrastrar.mjs` localiza una barra con `[data-assignment-id="7"]` y coge
                la PRIMERA. Si el rótulo llevara ese mismo atributo, la primera pasaría a ser el
                rótulo —va antes en el DOM— y el test se creería que agarra la barra mientras agarra
                otra cosa. Habría seguido pasando en verde, midiendo lo que no era.
            -->
            <div
                v-for="p in pintados"
                :key="p.key"
                data-t="rotulo"
                :data-rotulo-de="p.block.kind === 'shift' ? p.block.id : null"
                class="-mx-[4px] mt-[4px] flex items-start gap-[5px] rounded px-[4px] py-[1px] transition-colors first:mt-0"
                :class="arrastrable(p) ? 'cursor-grab active:cursor-grabbing touch-none' : ''"
                :style="resaltado(p) ? { background: 'rgb(127 119 221 / 14%)' } : null"
                @pointerenter="señalar(p)"
                @pointerleave="soltarSeñal"
                @pointerdown="coger($event, p)"
            >
                <span class="relative mt-[4px] block" :style="muestraStyle(p)">
                    <span
                        v-if="p.forzado"
                        class="absolute left-0 top-0 h-0 w-0 border-l-[4px] border-t-[4px] border-l-white border-t-transparent"
                    />
                </span>

                <span class="min-w-0 flex-1">
                    <!--
                        LA HORA SE LEE. NO SE SUSURRA. Estaba en gris claro (contraste 3,4) debajo
                        de un nombre en negrita, y en una parrilla de turnos "¿a qué hora entra?"
                        se pregunta tanto como "¿quién es?".
                    -->
                    <span class="tabular block text-[10.5px] font-semibold leading-tight text-ink">
                        {{ p.rotulo.hora }}<span v-if="p.nocturno" class="ml-[3px] text-[9px]">☾</span>
                    </span>

                    <span
                        v-if="p.rotulo.pie"
                        class="mt-[1px] block break-words text-[9.5px] font-semibold leading-tight"
                        :style="{ color: BRAND_DARK }"
                    >◷ {{ p.rotulo.pie }}</span>
                </span>
            </div>

            <!--
                La pista va HUNDIDA respecto a la celda. Antes era gris clarito sobre blanco y se
                confundía con el fondo, con el borde y con la tira: el mismo gris haciendo cuatro
                trabajos. Aquí solo hace uno — decir por dónde va el día.
            -->
            <div
                data-t="pista"
                class="relative mt-[5px] overflow-hidden rounded bg-sunken"
                :style="{
                    height: `${altoPista}px`,
                    backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
                    backgroundSize: gridEvery(axis, 6),
                }"
            >
                <!--
                    ⚠️ LA BARRA SE COGE, Y TAMBIÉN SE ENFOCA. Dos caminos, y el segundo no es adorno.

                    Arrastrar es el gesto natural con ratón. Pero un botón «×» dentro de la barra NO
                    cabe —un turno de una hora mide 5 px de ancho— y si cupiera taparía el relleno,
                    que es el canal de identidad (ley 2). Así que quitar tiene DOS caminos: la
                    papelera que aparece al arrastrar, y la tecla Supr con la barra enfocada — que es
                    el camino sin ratón, y el que un lector de pantalla puede recorrer.

                    ═══════════════════════════════════════════════════════════════════════════════
                    ⚠️⚠️ EL MARGEN DE AGARRE ES UN **PSEUDO-ELEMENTO**, Y ESO NO ES UN DETALLE DE CSS.
                    ═══════════════════════════════════════════════════════════════════════════════

                    `before:-inset-y-1` amplía el área de puntero 4 px arriba y 4 abajo: la barra
                    mide 16 px de alto y se agarra en una franja de 24.

                    LO PRIMERO QUE ESCRIBÍ FUE UN `<span>` HIJO CON ESE MISMO INSET. Y CEGÓ A LOS
                    INSTRUMENTOS. `pixel.mjs` busca un punto de la barra donde no haya ningún hijo
                    encima —para no medir el color de una letra o de la muesca en vez del relleno—:

                        const hijos = [...el.children].map((c) => c.getBoundingClientRect());

                    Un hijo que cubre el 100 % del ancho hace que NO EXISTA ningún punto libre. La
                    barra se descartaba entera, y con ella el anillo, la trama y la identidad. Medido:
                    `anchos.mjs` pasó de 24 barras con anillo a **CERO**. Las diez leyes de la matriz
                    visual dejaron de comprobarse — en silencio, sobre una página que se veía bien.

                    Un pseudo-elemento NO está en `children` y `elementFromPoint` lo atribuye a su
                    anfitrión, así que amplía el agarre sin taparle la cara a nadie.

                    ⚠️ Y SOLO ARRIBA Y ABAJO, NUNCA A LOS LADOS. Es la ley 16 otra vez: la distancia
                    entre dos barras de la misma persona NO es una constante, es TIEMPO convertido a
                    píxeles. Los dos turnos de Marco (20:00 y 21:00) distan 1 hora ≈ 6 px. Un margen
                    lateral de 4 px por lado se comería ese hueco, las dos zonas de agarre se
                    pisarían, y pulsar en medio cogería la barra que decidiera el orden del DOM. Un
                    asidero que a veces agarra el turno de al lado no es cómodo: MIENTE. Para el
                    ancho está el rótulo, que mide 100 px y nunca se confunde de barra.
                -->
                <div
                    v-for="p in pintados"
                    :key="p.key"
                    data-t="barra"
                    :data-assignment-id="p.block.kind === 'shift' ? p.block.id : null"
                    :style="barraStyle(p)"
                    :class="arrastrable(p)
                        ? 'cursor-grab active:cursor-grabbing touch-none before:absolute before:inset-x-0 before:-inset-y-1 before:content-[\'\']'
                        : ''"
                    :tabindex="arrastrable(p) ? 0 : null"
                    :aria-label="arrastrable(p) ? `${person.name}, ${p.rotulo.hora}. Arrastra para mover, pulsa para cambiar las horas, Supr para quitar.` : null"
                    @pointerenter="señalar(p)"
                    @pointerleave="soltarSeñal"
                    @pointerdown="coger($event, p)"
                    @keydown.delete.prevent="supr(p)"
                    @keydown.backspace.prevent="supr(p)"
                >
                    <!-- LA MUESCA: se forzó. Una decisión tomada, no un aviso desatendido. -->
                    <span
                        v-if="p.forzado"
                        data-t="muesca"
                        class="absolute left-0 top-0 h-0 w-0 border-l-[5px] border-t-[5px] border-l-white border-t-transparent"
                    />

                    <!-- EL FILO: cruza medianoche. "Sigue mañana." -->
                    <span
                        v-if="p.nocturno"
                        data-t="filo-noche"
                        class="absolute right-0 top-0 h-full w-[3px] rounded-r-[2px] bg-ink"
                    />
                </div>
            </div>

            <div
                v-for="(nota, i) in notas"
                :key="i"
                data-t="nota"
                class="mt-[5px] flex items-start gap-[5px] text-[9.5px] font-semibold leading-tight"
                :style="{ color: nota.color }"
            >
                <span
                    v-if="nota.dot"
                    class="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
                    :style="{ background: nota.color }"
                />
                <span class="min-w-0 break-words">{{ nota.text }}</span>
            </div>
        </div>
    </div>
</template>
