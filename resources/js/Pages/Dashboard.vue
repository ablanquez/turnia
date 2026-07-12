<script setup>
import { Link, router } from '@inertiajs/vue3';
import AppLayout from '../Layouts/AppLayout.vue';

defineProps({
    companies: { type: Array, required: true },
});

const logout = () => router.post('/logout');
</script>

<template>
    <AppLayout>
        <template #actions>
            <button
                class="rounded-lg border border-[--color-line] px-3 py-1.5 text-xs font-semibold text-[--color-ink-soft] hover:bg-[--color-brand-50]"
                @click="logout"
            >
                Salir
            </button>
        </template>

        <div class="mx-auto w-full max-w-3xl px-6 py-10">
            <h1 class="mb-6 text-lg font-bold text-[--color-ink]">Tus empresas</h1>

            <p v-if="companies.length === 0" class="text-sm text-[--color-ink-soft]">
                No tienes acceso a ninguna empresa.
            </p>

            <div class="flex flex-col gap-3">
                <div
                    v-for="company in companies"
                    :key="company.id"
                    class="rounded-xl border border-[--color-line] bg-white p-5"
                >
                    <div class="mb-3 flex items-center gap-3">
                        <span class="text-sm font-bold text-[--color-ink]">{{ company.name }}</span>
                        <span
                            class="rounded bg-[--color-brand-50] px-2 py-0.5 text-[10px] font-bold text-[--color-brand-800]"
                        >
                            {{ company.role }}
                        </span>
                    </div>

                    <div class="flex flex-wrap gap-2">
                        <Link
                            v-for="calendar in company.calendars"
                            :key="calendar.id"
                            :href="`/companies/${company.id}/calendars/${calendar.id}/schedule`"
                            class="rounded-lg border border-[--color-line] px-3 py-1.5 text-xs font-semibold text-[--color-brand-600] hover:bg-[--color-brand-50]"
                        >
                            {{ calendar.name }} →
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    </AppLayout>
</template>
