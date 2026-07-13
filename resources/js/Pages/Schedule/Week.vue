<script setup>
import AppLayout from '../../Layouts/AppLayout.vue';
import CatalogueConflicts from '../../Components/Schedule/CatalogueConflicts.vue';
import Legend from '../../Components/Schedule/Legend.vue';
import ScheduleHeader from '../../Components/Schedule/ScheduleHeader.vue';
import WeekGrid from '../../Components/Schedule/WeekGrid.vue';
import StaffPanel from '../../Components/Staff/StaffPanel.vue';

defineProps({
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
    </AppLayout>
</template>
