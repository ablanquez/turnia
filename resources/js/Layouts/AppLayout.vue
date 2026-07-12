<script setup>
import { Link } from '@inertiajs/vue3';
</script>

<template>
    <div class="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden">
        <header
            class="sticky top-0 z-20 flex items-center gap-4 border-b border-line bg-white px-6 py-3.5"
        >
            <Link href="/dashboard" class="flex items-center gap-3">
                <svg width="26" height="26" viewBox="0 0 40 40" aria-hidden="true">
                    <circle
                        cx="20" cy="20" r="14" fill="none"
                        stroke="#7F77DD" stroke-width="5" stroke-dasharray="7.5 3.8"
                    />
                    <circle cx="20" cy="20" r="4.5" fill="#534AB7" />
                </svg>
                <span class="text-base font-bold tracking-tight text-brand-800">TURNIA</span>
            </Link>

            <div class="h-[22px] w-px bg-line" />

            <div class="flex flex-1 items-center gap-4">
                <slot name="nav" />
            </div>

            <slot name="actions" />
        </header>

        <slot name="banner" />

        <main class="flex min-h-0 w-full min-w-0 flex-1 items-stretch overflow-hidden">
            <slot />
        </main>
    </div>
</template>
