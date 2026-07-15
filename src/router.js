import { createRouter, createWebHistory } from 'vue-router';
import Andamiaje from './components/Andamiaje.vue';

/*
 * ⚠️ EL SEAM MULTIDISPOSITIVO EMPIEZA AQUÍ, DESDE EL DÍA 0.
 *
 * El router es el punto donde, según la CAPACIDAD del dispositivo (puntero fino/grueso + viewport,
 * vía useDispositivo — Bloque 3), se servirá la vista de GESTIÓN (parrilla, PC, con arrastre) o la
 * de CONSULTA (móvil, sin arrastre, vista propia). No es "encoger" una vista: son vistas distintas
 * sobre los mismos datos.
 *
 * Ahora solo existe el andamiaje. Los huecos reservados:
 *   · '/estilo'         → tablero de estilo vivo        (Bloque 2)
 *   · gestión / consulta → Parrilla (PC) / VistaConsulta (móvil)   (Bloque 3)
 */
const routes = [
    { path: '/', name: 'inicio', component: Andamiaje },
];

export default createRouter({
    history: createWebHistory(),
    routes,
});
