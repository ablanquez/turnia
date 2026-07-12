<script setup>
/**
 * LA TIRA DE COBERTURA. El hueco se pinta DONDE OCURRE.
 *
 * "De 12 a 14 faltan 3; de 14 a 16 faltan 2." No es lo mismo que decir que falta gente
 * toda la tarde: eso sería un aviso falso, y un aviso falso entrena al encargado a
 * ignorar los avisos.
 *
 * Los segmentos vienen ya partidos del motor (CoverageCalculator), por los bordes de los
 * turnos Y de los requisitos. Aquí solo se pintan, cada uno con su anchura real sobre el
 * mismo eje que las barras de arriba: el hueco cae justo debajo del sitio donde falta.
 */
const props = defineProps({
    segments: { type: Array, required: true },
    axis: { type: Object, required: true },
    // Un puesto que NADIE de la plantilla puede cubrir no es un hueco normal: el problema
    // no está en el cuadrante, está en el catálogo.
    uncoverable: { type: Boolean, default: false },
});

const gridSize = `${100 / ((props.axis.to - props.axis.from) / 6)}% 100%`;

const style = (segment) => {
    const base = {
        position: 'absolute',
        left: `${segment.left}%`,
        width: `${segment.width}%`,
        top: 0,
        bottom: 0,
        boxSizing: 'border-box',
    };

    if (segment.missing > 0) {
        return { ...base, background: 'rgba(220,38,38,.24)', borderTop: '2px solid #DC2626' };
    }

    // El exceso NO es un error, y por eso no es rojo: es índigo. Sobra gente, que un
    // sábado puede ser justo lo que querías.
    if (segment.excess > 0) {
        return { ...base, background: 'rgba(127,119,221,.26)', borderTop: '2px solid #7F77DD' };
    }

    return { ...base, background: 'rgba(21,128,61,.18)', borderTop: '2px solid #15803D' };
};

const label = (segment) => {
    if (segment.missing > 0) {
        return `-${segment.missing}`;
    }
    if (segment.excess > 0) {
        return `+${segment.excess}`;
    }
    return '';
};

const tip = (segment) => `${segment.label} · pide ${segment.required}, hay ${segment.covered}`;
</script>

<template>
    <div>
        <div
            v-if="uncoverable"
            class="mb-1.5 inline-block rounded bg-[#5A5A66] px-1.5 py-0.5 text-[9px] font-bold text-white"
            title="El problema no está en el cuadrante: está en el catálogo"
        >
            Sin candidato en el catálogo
        </div>

        <div
            class="relative h-[15px] overflow-hidden rounded-sm"
            :style="{
                background: '#F5F4F8',
                backgroundImage: 'linear-gradient(90deg,#E6E5EE 1px,transparent 1px)',
                backgroundSize: gridSize,
            }"
        >
            <div v-for="(s, i) in segments" :key="i" :style="style(s)" :title="tip(s)" />

            <span
                v-for="(s, i) in segments"
                :key="`l${i}`"
                class="tabular pointer-events-none absolute top-0 text-center text-[10px] font-bold leading-[15px]"
                :style="{
                    left: `${s.left}%`,
                    width: `${s.width}%`,
                    color: s.missing > 0 ? '#B0141C' : '#534AB7',
                }"
            >{{ label(s) }}</span>
        </div>
    </div>
</template>
