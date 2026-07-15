<script setup>
/*
 * LA MARCA — logo índigo (heredado literal del viejo) + wordmark.
 *
 * El SVG con sus hex vive en logo.svg (literal heredado, permitido). Aquí no hay ni un #hex: el
 * texto usa el token de marca. El día que exista un logo definitivo, se cambia logo.svg y aparece
 * en todos lados. Nada cableado.
 */
import logoUrl from './logo.svg';

defineProps({
    tamano: { type: Number, default: 26 },
});
</script>

<template>
    <span class="inline-flex items-center gap-3">
        <img :src="logoUrl" :width="tamano" :height="tamano" alt="TURNIA" />
        <span class="text-base font-bold tracking-tight text-brand-800">TURNIA</span>
    </span>
</template>
