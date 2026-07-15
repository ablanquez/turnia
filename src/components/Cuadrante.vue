<script setup>
/*
 * EL CUADRANTE — el punto donde el seam multidispositivo decide qué vista servir.
 *
 * Según la CAPACIDAD (no el ancho a secas): gestión → la parrilla (PC); consulta → la vista de
 * móvil (aún un stub). Son vistas distintas sobre los mismos datos, no una encogida.
 */
import { useDispositivo } from '../composables/useDispositivo.js';
import Parrilla from './Parrilla.vue';
import VistaConsulta from './VistaConsulta.vue';

const { esGestion } = useDispositivo();
</script>

<template>
    <Parrilla v-if="esGestion" />
    <VistaConsulta v-else />
</template>
