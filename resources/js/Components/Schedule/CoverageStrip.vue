<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { gridEvery } from '../../composables/useAxis.js';

/**
 * LA TIRA DE COBERTURA. Se pinta EL DÍA ENTERO, no solo lo que está mal.
 *
 * ⚠️ Y SE PINTA CON COLORES QUE SE VEN.
 *
 * El verde iba a rgba(21,128,61,.18) sobre un gris claro: el color que salía de esa mezcla
 * era #DDE6DE — o sea, UN GRIS. Los 27 tramos verdes estaban en el DOM y en la pantalla no
 * había ni uno. Medí el array y no el píxel.
 *
 * Y el verde NO es decorativo: es lo que da ESTRUCTURA al día. Sin él, cada celda es un
 * rectángulo gris indistinguible del de al lado; con él, se ve de un vistazo qué está
 * resuelto y qué no. Es la única fila de la celda que se lee sin leer.
 *
 * El hueco se pinta DONDE OCURRE: "de 12 a 16 faltan 3; de 16 a 20 faltan 2". Decir que
 * falta gente todo el sábado sería un aviso falso, y un aviso falso entrena a ignorar los
 * avisos.
 */
const props = defineProps({
    segments: { type: Array, required: true },
    axis: { type: Object, required: true },
    // En el zoom Día hay sitio: "faltan 2" en vez de "-2".
    wide: { type: Boolean, default: false },
});

/**
 * EL DÉFICIT ES ROJO. EL RAYADO SE PONE ENCIMA. LOS DOS, A LA VEZ.
 *
 * ⚠️ SEGUNDO INTENTO, Y EL PRIMERO SEGUÍA ANULANDO UN DATO CON EL OTRO.
 *
 * "Faltan 2" y "no hay a quién poner" son DOS informaciones, y el rayado gris se comía a la
 * primera dos veces seguidas: antes con un "sin…" truncado, y después —ya con su número—
 * pintando gris sobre gris, con lo que en la pantalla NO SE VEÍA que faltara nadie. El
 * número estaba en el DOM y el hueco no estaba en el ojo.
 *
 * Ahora el tramo del sumiller es UN HUECO ROJO, como cualquier otro hueco, y las rayas van
 * SUPERPUESTAS encima: el rojo dice cuánta gente falta, la textura dice que el problema no
 * se arregla colocando a nadie. Ninguna de las dos tapa a la otra.
 */
const RAYAS = 'repeating-linear-gradient(45deg, rgba(60,56,84,.30) 0 4px, transparent 4px 9px)';

const ESTILO = {
    covered: { bg: 'var(--color-ok-fill)', border: 'var(--color-ok)', color: '#0F5C2C' },
    missing: { bg: 'var(--color-missing-fill)', border: 'var(--color-missing)', color: '#9E1616' },
    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },
};

/**
 * Un hueco que nadie del catálogo puede tapar SIGUE SIENDO UN HUECO ROJO. Lo que cambia es
 * que además lleva rayas. No cambia ni el color, ni el borde, ni el número.
 */
const estiloDe = (s) => {
    const base = ESTILO[s.state];

    if (! s.uncoverable || s.state !== 'missing') {
        return base;
    }

    return { ...base, bg: `${RAYAS}, ${base.bg}`, rayado: true };
};

const style = (s) => ({
    position: 'absolute',
    left: `${s.left}%`,
    width: `${s.width}%`,
    top: 0,
    bottom: 0,
    boxSizing: 'border-box',
    background: estiloDe(s).bg,
    borderTop: `2px solid ${estiloDe(s).border}`,
});

/**
 * ⚠️ NUNCA SE RECORTA UN DATO AL PINTARLO.
 *
 * Aquí ponía `truncate`, y en un tramo estrecho salía "sin…": ilegible Y sin el número. Un
 * rótulo a medias no es medio dato, es un error con aspecto de dato.
 *
 * Así que se MIDE el sitio que hay y se BAJA DE ESCALÓN: primero la frase entera, luego la
 * cifra sola, y si no cabe ni la cifra, nada — el color sigue diciendo qué pasa y el tooltip
 * lo dice entero. Lo que no se hace jamás es cortar el texto por la mitad.
 */
const tira = ref(null);
const ancho = ref(0);

let observador = null;

onMounted(() => {
    if (!tira.value) {
        return;
    }

    observador = new ResizeObserver(([e]) => {
        ancho.value = e.contentRect.width;
    });

    observador.observe(tira.value);
    ancho.value = tira.value.getBoundingClientRect().width;
});

onBeforeUnmount(() => observador?.disconnect());

/*
 * 10 px en IBM Plex Mono: ~6,1 px por carácter, más 2 px de aire.
 *
 * ⚠️ EL AIRE ERA DE 6 px Y SE COMÍA EL DATO. Un tramo de 3 h en la semana mide 17 px y "-1"
 * ocupa 12: con 6 px de margen no "cabía", así que el déficit del sumiller no se pintaba en
 * ninguna parte. Cambiar un recorte por una desaparición no es arreglarlo.
 *
 * Si de verdad no cabe (un tramo de una hora), el color y el tooltip siguen diciéndolo, y en
 * el zoom Día se lee entero. Eso es degradar, no recortar: lo que no se hace nunca es
 * enseñar media cifra.
 */
const cabe = (texto, s) => texto.length * 6.1 + 2 <= (s.width / 100) * ancho.value;

const escalones = (s) => {
    if (s.state === 'missing') {
        return [`faltan ${s.missing}`, `-${s.missing}`];
    }

    if (s.state === 'excess') {
        return [`sobra${s.excess > 1 ? 'n' : ''} ${s.excess}`, `+${s.excess}`];
    }

    // El tramo correcto no lleva número: el verde ya lo dice, y un "0" sería ruido.
    return [];
};

const label = (s) => {
    const opciones = props.wide ? escalones(s) : escalones(s).slice(1);

    return opciones.find((texto) => cabe(texto, s)) ?? '';
};

const tip = (s) => {
    const partes = [`${s.label} · pide ${s.required}, hay ${s.covered}`];

    if (s.uncoverable) {
        partes.push('nadie de la plantilla está cualificado para este puesto');
    }

    return partes.join(' · ');
};
</script>

<template>
    <!--
        Los data-t son ganchos para el instrumento visual (tests/Visual/backtest.mjs): le dicen
        DÓNDE mirar. Lo que mide —color, geometría, texto pintado— se lo sigue preguntando al
        navegador, nunca a estos atributos.
    -->
    <div
        ref="tira"
        data-t="tira"
        class="relative overflow-hidden rounded-sm bg-sunken"
        :class="wide ? 'h-[18px]' : 'h-[15px]'"
        :style="{
            backgroundImage: 'linear-gradient(90deg, rgb(255 255 255 / 55%) 1px, transparent 1px)',
            backgroundSize: gridEvery(axis, wide ? 3 : 6),
        }"
    >
        <div v-for="(s, i) in segments" :key="i" data-t="tramo" :style="style(s)" :title="tip(s)" />

        <span
            v-for="(s, i) in segments"
            :key="`l${i}`"
            data-t="tramo-rotulo"
            class="tabular pointer-events-none absolute top-0 whitespace-nowrap text-center font-bold"
            :class="wide ? 'text-[10px] leading-[18px]' : 'text-[10px] leading-[15px]'"
            :style="{ left: `${s.left}%`, width: `${s.width}%`, color: estiloDe(s).color }"
        >{{ label(s) }}</span>
    </div>
</template>
