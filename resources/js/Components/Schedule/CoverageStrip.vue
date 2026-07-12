<script setup>
import { gridEvery } from '../../composables/useAxis.js';

/**
 * LA TIRA DE COBERTURA. Se pinta EL DÍA ENTERO, no solo lo que está mal.
 *
 * Aquí solo salían los huecos, y el resto quedaba en gris. Parecía razonable y era un
 * SILENCIO FALSO DIBUJADO: el gris decía a la vez "esto está cubierto" y "aquí no se pide
 * nada". Dos cosas OPUESTAS con el mismo color. Ahora el verde dice "resuelto" y el gris
 * dice, solo, "aquí nadie ha pedido gente".
 *
 * Y el hueco se pinta DONDE OCURRE: "de 12 a 14 faltan 3; de 14 a 16 faltan 2". Decir que
 * falta gente toda la tarde sería un aviso falso, y un aviso falso entrena a ignorar los
 * avisos.
 */
const props = defineProps({
    segments: { type: Array, required: true },
    axis: { type: Object, required: true },
    // En el zoom Día hay sitio: "faltan 2" en vez de "-2".
    wide: { type: Boolean, default: false },
});

const ESTILO = {
    covered: { bg: 'rgba(21,128,61,.18)', border: '2px solid #15803D', color: null },
    missing: { bg: 'rgba(220,38,38,.24)', border: '2px solid #DC2626', color: '#B0141C' },
    excess: { bg: 'rgba(127,119,221,.26)', border: '2px solid #7F77DD', color: '#534AB7' },
    // Rayado gris, NO rojo. Un hueco rojo dice "ponle a alguien", y aquí no hay a quién
    // poner: el problema no está en el cuadrante, está en el catálogo.
    uncoverable: {
        bg: 'repeating-linear-gradient(45deg,#DEDEE6 0 5px,#F2F2F6 5px 10px)',
        border: '2px solid #8A8A99',
        color: '#5A5A66',
    },
};

const style = (s) => ({
    position: 'absolute',
    left: `${s.left}%`,
    width: `${s.width}%`,
    top: 0,
    bottom: 0,
    boxSizing: 'border-box',
    background: ESTILO[s.state].bg,
    borderTop: ESTILO[s.state].border,
});

const label = (s) => {
    if (s.state === 'uncoverable') {
        return props.wide ? 'sin candidato' : 'sin cand.';
    }
    if (s.state === 'missing') {
        return props.wide ? `faltan ${s.missing}` : `-${s.missing}`;
    }
    if (s.state === 'excess') {
        return props.wide ? `sobra${s.excess > 1 ? 'n' : ''} ${s.excess}` : `+${s.excess}`;
    }
    // El tramo correcto NO lleva número: el verde ya lo dice, y un "0" sería ruido.
    return '';
};

const tip = (s) => `${s.label} · pide ${s.required}, hay ${s.covered}`;
</script>

<template>
    <div
        class="relative overflow-hidden rounded-sm"
        :class="wide ? 'h-4' : 'h-[15px]'"
        :style="{
            background: '#F5F4F8',
            backgroundImage: 'linear-gradient(90deg,#E6E5EE 1px,transparent 1px)',
            backgroundSize: gridEvery(axis, wide ? 3 : 6),
        }"
    >
        <div v-for="(s, i) in segments" :key="i" :style="style(s)" :title="tip(s)" />

        <span
            v-for="(s, i) in segments"
            :key="`l${i}`"
            class="tabular pointer-events-none absolute top-0 truncate text-center font-bold"
            :class="wide ? 'text-[9.5px] leading-4' : 'text-[10px] leading-[15px]'"
            :style="{ left: `${s.left}%`, width: `${s.width}%`, color: ESTILO[s.state].color }"
        >{{ label(s) }}</span>
    </div>
</template>
