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
 * EL RAYADO GRIS DICE "NO HAY A QUIÉN PONER". EL NÚMERO DICE CUÁNTOS FALTAN.
 *
 * Son dos informaciones distintas y una se estaba comiendo a la otra: el tramo del sumiller
 * ponía "sin…" —truncado, ilegible— y el déficit no aparecía por ningún lado. Que nadie
 * pueda cubrirlo no hace que falte menos gente.
 *
 * Ahora el hueco lleva su número como cualquier otro hueco, y el "no hay candidato" se dice
 * donde ya se decía: con el rayado, con la etiqueta de la celda y con la banda de arriba.
 */
const ESTILO = {
    covered: { bg: 'var(--color-ok-fill)', border: 'var(--color-ok)', color: '#0F5C2C' },
    missing: { bg: 'var(--color-missing-fill)', border: 'var(--color-missing)', color: '#9E1616' },
    excess: { bg: 'var(--color-excess-fill)', border: 'var(--color-brand-300)', color: 'var(--color-brand-600)' },
    // Rayado, NO rojo. Un hueco rojo dice "ponle a alguien", y aquí no hay a quién poner:
    // el problema no está en el cuadrante, está en el catálogo.
    uncoverable: {
        bg: 'repeating-linear-gradient(45deg, var(--color-void-fill) 0 5px, #EFEDF5 5px 10px)',
        border: '#8A8699',
        color: '#57536A',
    },
};

/** Un hueco que nadie del catálogo puede tapar sigue siendo un hueco: cambia el color, no el número. */
const estiloDe = (s) => ESTILO[s.uncoverable && s.state === 'missing' ? 'uncoverable' : s.state];

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
