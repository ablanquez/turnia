/*
 * EL ARRASTRE — coger una ficha y soltarla en otra celda (Bloque 4 · tanda 1).
 *
 * POINTER EVENTS a mano, no HTML5 Drag&Drop ni librería. Y no por gusto: la restricción de Antonio
 * —el arrastre NO toca el color de la barra— descartó la API estándar, porque el DnD nativo genera una
 * drag-image SEMITRANSPARENTE del elemento (altera el color resultante del relleno de identidad, y no
 * hay forma limpia de impedirlo), y las librerías populares clonan con opacidad. Pointer Events da
 * control visual TOTAL: aquí decidimos exactamente qué se mueve y cómo, sin tocar el color. Además
 * unifica ratón/táctil/lápiz. (Ver bitácora: «la API estándar de arrastre viola la restricción».)
 *
 * `setPointerCapture` resuelve el problema clásico (en cuanto el cursor sale del elemento deja de
 * recibir eventos): capturamos el puntero y seguimos recibiéndolo aunque se vaya lejos. El hit-testing
 * («¿sobre qué celda estoy?») lo hace elementFromPoint contra los data-celda; el proxy lleva
 * pointer-events:none para no taparse a sí mismo.
 *
 * Es la FONTANERÍA que heredarán la tanda 2 (cambiar hora) y la 3 (crear): coger / mover / soltar.
 */
import { reactive } from 'vue';
import { mover } from './useCuadrante.js';
import { PERSONAS_POR_ID } from '../datos/semana.js';

const UMBRAL = 5; // px de movimiento antes de considerar que es un arrastre, no un clic

// Estado reactivo del arrastre en curso (uno a la vez). Lo leen la Parrilla (proxy), la Celda
// (resalte del destino) y la Ficha (fantasma en origen).
const estado = reactive({
    activo: false, // ¿pasado el umbral? (hay arrastre de verdad)
    turno: null, // el turno que se coge (con su id)
    color: null, // color de identidad, para pintar el proxy a color pleno
    nombre: null,
    x: 0, y: 0, // posición actual del puntero
    offX: 0, offY: 0, // desfase puntero→esquina de la ficha al cogerla (para que el proxy no salte)
    ancho: 0, // ancho de la ficha original (el proxy conserva su tamaño)
    destino: null, // { dia, puesto } de la celda bajo el puntero, o null
});

let candidato = null; // turno pendiente de superar el umbral
let inicioX = 0, inicioY = 0;

function celdaBajo(x, y) {
    const el = document.elementFromPoint(x, y);
    const celda = el && el.closest('[data-celda]');
    if (!celda) return null;
    return { dia: celda.dataset.dia, puesto: celda.dataset.puesto };
}

function alMover(e) {
    if (!candidato) return;
    if (!estado.activo) {
        if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < UMBRAL) return;
        // Se supera el umbral: empieza el arrastre de verdad.
        const p = PERSONAS_POR_ID[candidato.persona];
        estado.turno = candidato;
        estado.color = p.color;
        estado.nombre = p.nombre;
        estado.activo = true;
    }
    estado.x = e.clientX;
    estado.y = e.clientY;
    estado.destino = celdaBajo(e.clientX, e.clientY);
}

function alSoltar() {
    if (estado.activo && estado.destino && estado.turno) {
        const d = estado.destino, t = estado.turno;
        // Fuera de una celda (destino null) o misma celda → no-op (moverTurno ya lo trata, pero
        // aquí evitamos incluso la llamada). Otra celda → se mueve.
        if (d.dia !== t.dia || d.puesto !== t.puesto) mover(t.id, d);
    }
    limpiar();
}

function alTecla(e) {
    if (e.key === 'Escape') limpiar(); // cancela: la ficha vuelve a su origen, sin mover
}

function limpiar() {
    estado.activo = false;
    estado.turno = null;
    estado.destino = null;
    candidato = null;
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alSoltar);
    window.removeEventListener('pointercancel', limpiar);
    window.removeEventListener('keydown', alTecla);
}

/** Se llama en el pointerdown de una ficha. Arma el candidato; no arrastra hasta superar el umbral. */
function alCoger(e, turno) {
    if (e.button != null && e.button !== 0) return; // solo botón principal
    const r = e.currentTarget.getBoundingClientRect();
    candidato = turno;
    inicioX = e.clientX;
    inicioY = e.clientY;
    estado.offX = e.clientX - r.left;
    estado.offY = e.clientY - r.top;
    estado.ancho = r.width;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* algunos entornos no lo soportan */ }
    window.addEventListener('pointermove', alMover);
    window.addEventListener('pointerup', alSoltar);
    window.addEventListener('pointercancel', limpiar);
    window.addEventListener('keydown', alTecla);
}

export function useArrastre() {
    return { arrastre: estado, alCoger };
}
