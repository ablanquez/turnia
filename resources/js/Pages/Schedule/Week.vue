<script setup>
import { provide } from 'vue';
import AppLayout from '../../Layouts/AppLayout.vue';
import AvisoEstrecho from '../../Components/Schedule/AvisoEstrecho.vue';
import CatalogueConflicts from '../../Components/Schedule/CatalogueConflicts.vue';
import CapaDeEdicion from '../../Components/Schedule/CapaDeEdicion.vue';
import Legend from '../../Components/Schedule/Legend.vue';
import ScheduleHeader from '../../Components/Schedule/ScheduleHeader.vue';
import WeekGrid from '../../Components/Schedule/WeekGrid.vue';
import StaffPanel from '../../Components/Staff/StaffPanel.vue';
import { useEdicion } from '../../composables/useEdicion.js';

const props = defineProps({
    company: { type: Object, required: true },
    calendar: { type: Object, required: true },
    window: { type: Object, required: true },
    axis: { type: Object, required: true },
    granularity: { type: String, required: true },
    positions: { type: Array, required: true },
    people: { type: Array, required: true },
    assignments: { type: Array, required: true },
    conceptEntries: { type: Array, required: true },
    absences: { type: Array, required: true },
    staff: { type: Array, required: true },
    can: { type: Object, required: true },

    // DIFERIDAS, y las dos en el MISMO grupo: llegan juntas, después del primer pintado.
    // La cobertura va aquí porque DEPENDE del informe (un turno imposible no cubre el puesto).
    violations: { type: Object, default: undefined },
    coverage: { type: Object, default: undefined },
});

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LA CAPA QUE EDITA VIVE EN LA PÁGINA, Y NO EN LA REJILLA. Y no es una manía de arquitecto.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Un arrastre empieza en el PANEL DE PLANTILLA y acaba en la REJILLA. Son dos componentes hermanos:
 * ninguno de los dos contiene al otro, así que ninguno de los dos puede ser el dueño del gesto. El
 * único sitio que los tiene a los dos es la página.
 *
 * Se pasa por `provide` y no por props porque tendría que atravesar tres niveles (rejilla → celda →
 * carril → barra) por componentes que no tienen NADA que decir sobre el arrastre.
 *
 * ⚠️ Y SI EL QUE MIRA NO PUEDE GESTIONAR, AQUÍ SE PROVEE `null`.
 *
 * No se «esconde el botón»: es que el gesto NO EXISTE para él. Las barras no se pueden coger, el
 * panel no arranca nada, y la papelera no aparece. Y aun así, la Policy lo vuelve a decir en el
 * servidor — porque una interfaz que no ofrece un gesto NO ES una autorización: es una cortesía.
 */
const edicion = useEdicion(props.company, props.calendar, {
    window: props.window,
    positions: props.positions,
});

provide('edicion', props.can.manage ? edicion : null);
</script>

<template>
    <AppLayout>
        <template #nav>
            <ScheduleHeader
                :company="company"
                :calendar="calendar"
                :window="window"
                :granularity="granularity"
                :violations="violations"
                :coverage="coverage"
            />
        </template>

        <template #banner>
            <Legend :axis="axis" />

            <!-- Si la ventana es demasiado estrecha para los siete días, se DICE. Ver useAncho.js. -->
            <AvisoEstrecho
                :company="company"
                :calendar="calendar"
                :day="window.days[0].date"
            />

            <CatalogueConflicts :conflicts="coverage?.conflicts ?? []" />
        </template>

        <div class="flex min-h-0 w-full min-w-0 flex-1 items-stretch overflow-hidden">
            <WeekGrid
                :company="company"
                :calendar="calendar"
                :window="window"
                :axis="axis"
                :positions="positions"
                :people="people"
                :assignments="assignments"
                :concept-entries="conceptEntries"
                :absences="absences"
                :coverage="coverage ?? null"
                :violations="violations ?? null"
            />

            <StaffPanel
                v-if="can.seeStaff"
                :staff="staff"
                :assignments="assignments"
                :violations="violations ?? null"
            />
        </div>

        <!-- El fantasma, la papelera y los dos diálogos. Todo lo que flota POR ENCIMA de la página. -->
        <CapaDeEdicion />
    </AppLayout>
</template>
