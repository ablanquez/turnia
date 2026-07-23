/*
 * EL ARRASTRE — coger una ficha y, según DÓNDE se suelte, REUBICARLA (otra celda, conserva horas ·
 * tanda 1) o RETIMARLA (misma celda, otra posición horizontal → nuevo horario · tanda 2).
 *
 * POINTER EVENTS a mano, no HTML5 Drag&Drop ni librería: la restricción de no tocar el color de la
 * barra descartó la API estándar (drag-image semitransparente) y las librerías (clonan con opacidad).
 * Ver bitácora. Pointer Events da control visual total y unifica ratón/táctil; setPointerCapture
 * sostiene el gesto; elementFromPoint hace el hit-testing contra los data-celda.
 *
 * UN SOLO GESTO, el modo lo decide dónde sueltas — extiende «sabes dónde vas a soltar antes de
 * soltar» con «y a qué hora». A 5,35 px/hora estirar bordes es ingrabbable (ver diseño): esta tanda
 * DESPLAZA (conserva duración), no redimensiona. El desplazamiento se ajusta a la granularidad
 * (media hora) y el eje/pista dan la escala px→minutos.
 */
import { reactive } from 'vue';
import { mover, retimar, eje } from './useCuadrante.js';
import { abrirEditor } from './useEditor.js';
import { PERSONAS_POR_ID } from '../datos/semana.js';
import { ajustaGranularidad, formatoHora } from './useEje.js';

const UMBRAL = 5; // px de movimiento antes de considerar que es un arrastre, no un clic

const estado = reactive({
    activo: false, // ¿pasado el umbral?
    turno: null, // el turno cogido (normalizado: iniMin/finMin)
    color: null, nombre: null, // para pintar el proxy
    x: 0, y: 0, offX: 0, offY: 0, ancho: 0, // posición y tamaño del proxy
    destino: null, // { dia, puesto } de la celda bajo el puntero
    modo: null, // 'reubicar' | 'retimar' | null
    retIni: null, // nuevo inicio (min, snapped) cuando se retima
    horaIni: '', horaFin: '', // etiqueta en vivo del horario resultante
});

let candidato = null;
let inicioX = 0, inicioY = 0;

function celdaBajo(x, y) {
    const el = document.elementFromPoint(x, y);
    const celda = el && el.closest('[data-celda]');
    return celda ? { dia: celda.dataset.dia, puesto: celda.dataset.puesto } : null;
}

// Ancho de una pista (constante entre columnas: todas son 1fr). Se mide la regla del arrastre si ya
// está pintada, o cualquier pista estática (nunca la del proxy). Da la escala px→minutos.
function anchoPista() {
    const regla = document.querySelector('[data-regla]');
    if (regla) return regla.getBoundingClientRect().width;
    const p = [...document.querySelectorAll('.bg-sunken')].find((x) => !x.closest('[data-proxy]'));
    return p ? p.getBoundingClientRect().width : 0;
}

function alMover(e) {
    if (!candidato) return;
    if (!estado.activo) {
        if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < UMBRAL) return;
        const p = PERSONAS_POR_ID[candidato.persona];
        estado.turno = candidato;
        estado.color = p.color;
        estado.nombre = p.nombre;
        estado.activo = true;
    }
    estado.x = e.clientX;
    estado.y = e.clientY;
    estado.destino = celdaBajo(e.clientX, e.clientY);

    const t = estado.turno;
    if (estado.destino && estado.destino.dia === t.dia && estado.destino.puesto === t.puesto) {
        // MISMA celda → RETIMAR: el desplazamiento horizontal (desde el agarre) es el cambio de hora.
        estado.modo = 'retimar';
        const w = anchoPista();
        const span = eje.value.hasta - eje.value.desde;
        const deltaMin = w ? (e.clientX - inicioX) * (span / w) : 0;
        const dur = t.finMin - t.iniMin;
        estado.retIni = ajustaGranularidad(t.iniMin + deltaMin);
        estado.horaIni = formatoHora(estado.retIni);
        estado.horaFin = formatoHora(estado.retIni + dur);
    } else if (estado.destino) {
        estado.modo = 'reubicar';
        estado.retIni = null;
    } else {
        estado.modo = null;
        estado.retIni = null;
    }
}

function alSoltar() {
    let cambio = false;
    const id = estado.turno && estado.turno.id;
    if (estado.activo && estado.turno) {
        const t = estado.turno;
        if (estado.modo === 'reubicar' && estado.destino) { mover(t.id, estado.destino); cambio = true; }
        else if (estado.modo === 'retimar' && estado.retIni != null && estado.retIni !== t.iniMin) { retimar(t.id, estado.retIni); cambio = true; }
    }
    limpiar();
    // Cualquier arrastre que CAMBIÓ algo (reubicar o retimar) abre el editor para afinar: regla única,
    // sin excepciones que memorizar. El arrastre ya se aplicó; el editor solo gobierna lo de dentro.
    if (cambio && id) abrirEditor(id);
}

function alTecla(e) {
    if (e.key === 'Escape') limpiar(); // cancela: nada se mueve
}

function limpiar() {
    estado.activo = false;
    estado.turno = null;
    estado.destino = null;
    estado.modo = null;
    estado.retIni = null;
    estado.horaIni = '';
    estado.horaFin = '';
    candidato = null;
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alSoltar);
    window.removeEventListener('pointercancel', limpiar);
    window.removeEventListener('keydown', alTecla);
}

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
