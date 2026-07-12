<script setup>
import { computed } from 'vue';
import AppLayout from '../../Layouts/AppLayout.vue';
import CatalogueConflicts from '../../Components/Schedule/CatalogueConflicts.vue';
import DayGrid from '../../Components/Schedule/DayGrid.vue';
import Legend from '../../Components/Schedule/Legend.vue';
import ScheduleHeader from '../../Components/Schedule/ScheduleHeader.vue';
import StaffPanel from '../../Components/Staff/StaffPanel.vue';

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
    coverage: { type: Object, required: true },
    staff: { type: Array, required: true },
    can: { type: Object, required: true },

    violations: { type: Object, default: undefined },
});

// La ventana del día tiene los dos extremos iguales: un solo día dentro.
const day = computed(() => props.window.days[0]);
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
            />
        </template>

        <template #banner>
            <Legend :axis="axis" />
            <CatalogueConflicts :conflicts="coverage.conflicts" />
        </template>

        <div class="flex min-h-0 flex-1 items-stretch">
            <div class="min-w-0 flex-1 overflow-x-auto">
                <DayGrid
                    :day="day"
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

            <StaffPanel
                v-if="can.seeStaff"
                :staff="staff"
                :assignments="assignments"
                :violations="violations ?? null"
            />
        </div>
    </AppLayout>
</template>
