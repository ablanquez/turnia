<script setup>
import { Deferred, Link, router } from '@inertiajs/vue3';
import { computed } from 'vue';
import ZoomTabs from './ZoomTabs.vue';

const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    window: { type: Object, required: true },
    granularity: { type: String, required: true },
    violations: { type: Object, default: undefined },
});

const base = computed(() => `/companies/${props.company.id}/calendars/${props.calendar.id}/schedule`);

const here = computed(() => (props.granularity === 'day'
    ? `${base.value}/day?day=`
    : `${base.value}?week=`));

const weekUrl = computed(() => `${base.value}?week=${props.window.weekOf}`);
const dayUrl = computed(() => `${base.value}/day?day=${props.window.from}`);

const conIncidencia = computed(() => (props.violations
    ? Object.keys(props.violations.assignments).length
        + Object.keys(props.violations.conceptEntries).length
        + Object.keys(props.violations.absences).length
    : 0));

const logout = () => router.post('/logout');
</script>

<template>
    <div class="flex items-center gap-2">
        <Link
            :href="`${here}${window.previous}`"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-brand-50"
        >‹</Link>

        <div class="min-w-[170px] text-center">
            <div class="text-[13.5px] font-bold text-ink">{{ window.label }}</div>
            <div class="tabular text-[10px] text-ink-faint">
                semana {{ window.isoWeek }} · {{ company.name }}
            </div>
        </div>

        <Link
            :href="`${here}${window.next}`"
            class="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-ink-soft hover:bg-brand-50"
        >›</Link>
    </div>

    <div class="flex-1" />

    <ZoomTabs :current="granularity" :week-url="weekUrl" :day-url="dayUrl" />

    <!--
        COMPROBANDO ≠ TODO CORRECTO.

        Mientras el informe no ha llegado, la parrilla no está diciendo que todo esté bien:
        está diciendo que TODAVÍA NO LO SABE. Pintar verde aquí sería fabricar un silencio
        falso, que es exactamente el fallo del que este proyecto se defiende. Por eso el
        indicador es explícito, y por eso NO es verde.
    -->
    <Deferred data="violations">
        <template #fallback>
            <span class="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-[11px] font-semibold text-brand-800">
                <span class="h-2 w-2 animate-pulse rounded-full bg-brand-300" />
                Comprobando incumplimientos…
            </span>
        </template>

        <span
            v-if="conIncidencia"
            class="tabular rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style="background: rgba(232,89,12,.1); color: #E8590C"
        >{{ conIncidencia }} con incidencias</span>

        <span
            v-else
            class="tabular rounded-lg px-3 py-1.5 text-[11px] font-semibold"
            style="background: rgba(21,128,61,.12); color: #15803D"
        >Sin incidencias</span>
    </Deferred>

    <button
        class="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-brand-50"
        @click="logout"
    >
        Salir
    </button>
</template>
