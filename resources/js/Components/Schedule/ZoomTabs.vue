<script setup>
import { Link } from '@inertiajs/vue3';

/**
 * Los niveles de zoom.
 *
 * Año, Mes y Horas salen APAGADOS y no es pereza: cada uno es un contrato de datos
 * distinto. El Año no puede mandar los turnos uno a uno (serían decenas de miles), así
 * que necesita agregados que todavía no hemos diseñado. Enseñarlos apagados es decir la
 * verdad; enseñarlos activos y que llevaran a una vista a medias sería peor.
 */
defineProps({
    current: { type: String, required: true }, // 'week' | 'day'
    weekUrl: { type: String, required: true },
    dayUrl: { type: String, required: true },
});
</script>

<template>
    <div class="tabular flex gap-0.5 rounded-lg bg-[#F4F3F9] p-0.5 text-[11px]">
        <span class="cursor-not-allowed px-2.5 py-1 text-ink-faint" title="Necesita agregados: no se pueden pintar 30.000 turnos uno a uno">Año</span>
        <span class="cursor-not-allowed px-2.5 py-1 text-ink-faint" title="Pendiente">Mes</span>

        <Link
            :href="weekUrl"
            class="rounded px-2.5 py-1"
            :class="current === 'week'
                ? 'bg-white font-semibold text-brand-800 shadow-sm'
                : 'text-ink-soft hover:text-brand-600'"
        >Semana</Link>

        <Link
            :href="dayUrl"
            class="rounded px-2.5 py-1"
            :class="current === 'day'
                ? 'bg-white font-semibold text-brand-800 shadow-sm'
                : 'text-ink-soft hover:text-brand-600'"
        >Día</Link>

        <span class="cursor-not-allowed px-2.5 py-1 text-ink-faint" title="Pendiente">Horas</span>
    </div>
</template>
