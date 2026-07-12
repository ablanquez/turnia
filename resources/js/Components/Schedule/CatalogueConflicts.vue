<script setup>
/**
 * LOS CONFLICTOS DEL CATÁLOGO, SEPARADOS DE LOS DEL CUADRANTE.
 *
 * "No hay nadie cualificado para sumiller" NO se arregla moviendo turnos. Si se mezclara
 * con los incumplimientos del cuadrante, el encargado buscaría el error donde no está.
 * El problema no está en la parrilla: está en el catálogo.
 *
 * Por eso van en su propia franja, en ámbar (son avisos) y arriba del todo.
 */
defineProps({
    conflicts: { type: Array, required: true },
});
</script>

<template>
    <div
        v-if="conflicts.length"
        class="flex flex-col gap-1 border-b border-line bg-[#FFFBF2] px-6 py-2.5"
    >
        <div
            v-for="(conflict, i) in conflicts"
            :key="i"
            class="flex items-start gap-2 text-[11.5px] font-medium text-notice"
        >
            <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-notice" />
            {{ conflict.message }}
        </div>
    </div>
</template>
