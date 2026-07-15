import { createRouter, createWebHistory } from 'vue-router';
import Cuadrante from './components/Cuadrante.vue';
import TableroEstilo from './components/TableroEstilo.vue';

/*
 * ⚠️ EL SEAM MULTIDISPOSITIVO EMPIEZA AQUÍ, DESDE EL DÍA 0.
 *
 * El router es el punto donde, según la CAPACIDAD del dispositivo (puntero fino/grueso + viewport,
 * vía useDispositivo — Bloque 3), se servirá la vista de GESTIÓN (parrilla, PC, con arrastre) o la
 * de CONSULTA (móvil, sin arrastre, vista propia). No es "encoger" una vista: son vistas distintas
 * sobre los mismos datos.
 *
 * Ahora solo existe el andamiaje. Los huecos reservados:
 *   · '/'       → Cuadrante: gestión (Parrilla, PC) o consulta (móvil), según useDispositivo
 *   · '/estilo' → tablero de estilo vivo (Bloque 2)
 */
const routes = [
    { path: '/', name: 'inicio', component: Cuadrante },
    { path: '/estilo', name: 'estilo', component: TableroEstilo },
];

export default createRouter({
    history: createWebHistory(),
    routes,
});
