<script setup>
/**
 * LA TIRA DE COBERTURA. El hueco se pinta DONDE OCURRE.
 *
 * "De 12 a 14 faltan 2; de 14 a 16 faltan 3." No es lo mismo que decir que falta
 * gente toda la tarde: eso sería un aviso falso, y un aviso falso entrena al
 * encargado a ignorar los avisos.
 *
 * Los segmentos vienen ya calculados del motor (CoverageCalculator), partidos por los
 * bordes de los turnos y de los requisitos. Aquí solo se pintan.
 */
defineProps({
    segments: { type: Array, required: true },
    // Puestos que NADIE de la plantilla puede cubrir. No son un hueco normal: el
    // problema no está en el cuadrante, está en el catálogo.
    uncoverable: { type: Boolean, default: false },
});

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

const labelColor = (segment) => (segment.missing > 0 ? '#B0141C' : '#534AB7');
</script>

<template>
    <div>
        <div
            v-if="uncoverable"
            class="mb-1.5 inline-block rounded bg-[#5A5A66] px-1.5 py-0.5 text-[9px] font-bold text-white"
        >
            Sin candidato en el catálogo
        </div>

        <div class="relative h-[15px] overflow-hidden rounded-sm bg-[#F5F4F8]">
            <div v-for="(segment, i) in segments" :key="i" :style="style(segment)" />

            <span
                v-for="(segment, i) in segments"
                :key="`l${i}`"
                class="tabular absolute top-0 text-center text-[10px] font-bold leading-[15px]"
                :style="{ left: `${segment.left}%`, width: `${segment.width}%`, color: labelColor(segment) }"
            >{{ label(segment) }}</span>
        </div>
    </div>
</template>
