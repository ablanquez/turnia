<script setup>
/*
 * VISTA DE CONSULTA (móvil) — STUB RESERVADO. No es la vista real.
 *
 * El seam multidispositivo se deja puesto desde el día 0, pero la vista de consulta se construye en
 * un bloque futuro: es OTRO contrato de datos (mi turno / mi semana), no la parrilla encogida.
 */
import Marca from '../estilo/marca/Marca.vue';
</script>

<template>
    <main class="grid min-h-screen place-items-center bg-page px-6 text-center text-ink">
        <div class="max-w-sm">
            <div class="flex justify-center">
                <Marca :tamano="34" />
            </div>
            <h1 class="mt-5 text-xl font-bold">Vista de consulta</h1>
            <p class="mt-2 text-sm text-ink-soft">
                La vista para móvil llega en un bloque futuro. La parrilla de gestión es densa y
                necesita ratón y pantalla ancha:
                <strong class="text-ink">ábrela en un ordenador</strong> para gestionar los turnos.
            </p>
        </div>
    </main>
</template>
