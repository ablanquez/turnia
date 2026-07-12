<script setup>
import { Deferred, Link, router } from '@inertiajs/vue3';
import { computed } from 'vue';
import AppLayout from '../../Layouts/AppLayout.vue';
import Legend from '../../Components/Schedule/Legend.vue';
import WeekGrid from '../../Components/Schedule/WeekGrid.vue';
import StaffPanel from '../../Components/Staff/StaffPanel.vue';

const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    window: { type: Object, required: true },
    axis: { type: Object, required: true },
    positions: { type: Array, required: true },
    people: { type: Array, required: true },
    assignments: { type: Array, required: true },
    conceptEntries: { type: Array, required: true },
    absences: { type: Array, required: true },
    coverage: { type: Object, required: true },
    staff: { type: Array, required: true },
    can: { type: Object, required: true },

    // DIFERIDA. Llega después del primer pintado.
    violations: { type: Object, default: undefined },
});

const base = computed(
    () => `/companies/${props.company.id}/calendars/${props.calendar.id}/schedule`,
);

const logout = () => router.post('/logout');

/** Los errores de CONFIGURACIÓN del catálogo, no del cuadrante. */
const conflicts = computed(() => props.coverage.conflicts);
</script>

<template>
    <AppLayout>
        <template #nav>
            <div class="flex items-center gap-2">
                <Link
                    :href="`${base}?week=${window.previous}`"
                    class="flex h-7 w-7 items-center justify-center rounded-lg border border-[--color-line] text-[--color-ink-soft] hover:bg-[--color-brand-50]"
                >‹</Link>

                <div class="min-w-[150px] text-center">
                    <div class="text-[13.5px] font-bold text-[--color-ink]">{{ window.label }}</div>
                    <div class="tabular text-[10px] text-[--color-ink-faint]">
                        semana {{ window.isoWeek }} · {{ company.name }}
                    </div>
                </div>

                <Link
                    :href="`${base}?week=${window.next}`"
                    class="flex h-7 w-7 items-center justify-center rounded-lg border border-[--color-line] text-[--color-ink-soft] hover:bg-[--color-brand-50]"
                >›</Link>
            </div>
        </template>

        <template #actions>
            <!--
                COMPROBANDO ≠ TODO CORRECTO.

                Mientras el informe no ha llegado, la parrilla NO está diciendo que todo
                esté bien: está diciendo que todavía no lo sabe. Pintar verde aquí sería
                fabricar un silencio falso, que es exactamente el fallo del que este
                proyecto se defiende. Por eso el indicador es explícito y NO es verde.
            -->
            <Deferred data="violations">
                <template #fallback>
                    <span
                        class="flex items-center gap-2 rounded-lg bg-[--color-brand-50] px-3 py-1.5 text-[11px] font-semibold text-[--color-brand-800]"
                    >
                        <span class="h-2 w-2 animate-pulse rounded-full bg-[--color-brand-300]" />
                        Comprobando incumplimientos…
                    </span>
                </template>

                <span
                    class="tabular rounded-lg border border-[--color-line] px-3 py-1.5 text-[11px] font-semibold text-[--color-ink-soft]"
                >
                    {{ Object.keys(violations.assignments).length }} turnos con incidencias
                </span>
            </Deferred>

            <button
                class="rounded-lg border border-[--color-line] px-3 py-1.5 text-xs font-semibold text-[--color-ink-soft] hover:bg-[--color-brand-50]"
                @click="logout"
            >
                Salir
            </button>
        </template>

        <template #banner>
            <Legend />

            <!--
                Los conflictos del CATÁLOGO se cuentan aparte de los del cuadrante: si se
                mezclaran, el encargado buscaría el error donde no está. "No hay nadie
                cualificado para sumiller" no se arregla moviendo turnos.
            -->
            <div
                v-if="conflicts.length"
                class="flex flex-col gap-1 border-b border-[--color-line] bg-[#FFFBF2] px-6 py-2.5"
            >
                <div
                    v-for="(conflict, i) in conflicts"
                    :key="i"
                    class="flex items-start gap-2 text-[11.5px] font-medium text-[--color-notice]"
                >
                    <span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[--color-notice]" />
                    {{ conflict.message }}
                </div>
            </div>
        </template>

        <div class="flex flex-1 items-stretch">
            <div class="flex-1 overflow-hidden">
                <WeekGrid
                    :window="window"
                    :axis="axis"
                    :positions="positions"
                    :people="people"
                    :assignments="assignments"
                    :concept-entries="conceptEntries"
                    :absences="absences"
                    :coverage="coverage"
                    :violations="violations ?? null"
                />
            </div>

            <StaffPanel v-if="can.seeStaff" :staff="staff" />
        </div>
    </AppLayout>
</template>
