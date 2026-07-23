/*
 * EL ARRASTRE — coger un TROZO y, según DÓNDE se suelte, REUBICAR (otra celda, conserva horas · tanda
 * 1) o RETIMAR (misma celda, otra posición horizontal → nuevo horario · tanda 2).
 *
 * ⚠️ CONSCIENTE DEL SEGMENTO (2.d · PC2). Un turno partido tiene dos trozos en días distintos; el de
 * cola vive en d+1, no en turno.dia. La decisión retimar/reubicar se toma comparando el destino con la
 * celda DEL TROZO AGARRADO (segDia + puesto), NO con turno.dia. Comparar con turno.dia reubicaría por
 * error al retimar la cola: un turno se mudaría de día sin avisar —fallo silencioso: no rompe, hace lo
 * que no es— (ver bitácora). El delta se aplica SIEMPRE al inicio del TURNO ENTERO (ente único): los
 * dos trozos se mueven juntos.
 *
 * CASO CRUZADO: arrastrar la cola (Vie) al día de la cabeza (Jue) es REUBICAR y resulta NO-OP, porque
 * el turno ya está anclado ahí (moverTurno devuelve la misma referencia). No es un caso especial: cae
 * de la regla general (reubicar pone turno.dia = destino.dia; si coincide, nada cambia).
 *
 * POINTER EVENTS a mano (ver bitácora: la API estándar de DnD violaría el color). setPointerCapture
 * sostiene el gesto; elementFromPoint hace el hit-testing contra los data-celda.
 */
import { reactive } from 'vue';
import { mover, retimar } from './useCuadrante.js';
import { abrirEditor } from './useEditor.js';
import { PERSONAS_POR_ID, DIAS } from '../datos/semana.js';
import { ajustaGranularidad, formatoHora, segmentar, EJE_DIA } from './useEje.js';

const UMBRAL = 5; // px de movimiento antes de considerar que es un arrastre, no un clic

const estado = reactive({
    activo: false, // ¿pasado el umbral?
    turno: null, // el turno cogido (normalizado: iniMin/finMin)
    color: null, nombre: null, // para pintar el proxy
    seg: null, // el TROZO agarrado { dia, iniLocal, finLocal, corteIni, corteFin } — el proxy lo pinta
    x: 0, y: 0, offX: 0, offY: 0, ancho: 0, // posición y tamaño del proxy
    destino: null, // { dia, puesto } de la celda bajo el puntero
    modo: null, // 'reubicar' | 'retimar' | null
    retIni: null, // nuevo inicio del TURNO ENTERO (min, snapped) cuando se retima
    retSeg: null, // bounds locales del trozo agarrado tras el retimado (para el contorno-preview)
    horaIni: '', horaFin: '', // etiqueta en vivo del horario resultante (turno entero)
});

let candidato = null;
let candidatoSeg = null;
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

/** PURA: decide el modo según DÓNDE se suelta. Retimar SOLO si el destino es la celda DEL TROZO
 *  agarrado (segmento.dia + puesto del turno); cualquier otra celda es reubicar. El uso de segmento.dia
 *  —y NO turno.dia— es lo que evita que retimar la cola de un turno partido lo mude de día. */
export function modoArrastre(destino, segmento, turno) {
    if (!destino) return null;
    return destino.dia === segmento.dia && destino.puesto === turno.puesto ? 'retimar' : 'reubicar';
}

function alMover(e) {
    if (!candidato) return;
    if (!estado.activo) {
        if (Math.hypot(e.clientX - inicioX, e.clientY - inicioY) < UMBRAL) return;
        const p = PERSONAS_POR_ID[candidato.persona];
        estado.turno = candidato;
        estado.color = p.color;
        estado.nombre = p.nombre;
        estado.seg = candidatoSeg;
        estado.activo = true;
    }
    estado.x = e.clientX;
    estado.y = e.clientY;
    estado.destino = celdaBajo(e.clientX, e.clientY);

    const t = estado.turno;
    estado.modo = modoArrastre(estado.destino, estado.seg, t);
    if (estado.modo === 'retimar') {
        // el desplazamiento horizontal (desde el agarre) es el cambio de hora, aplicado al TURNO ENTERO.
        const w = anchoPista();
        const span = EJE_DIA.hasta - EJE_DIA.desde;
        const deltaMin = w ? (e.clientX - inicioX) * (span / w) : 0;
        const dur = t.finMin - t.iniMin;
        estado.retIni = ajustaGranularidad(t.iniMin + deltaMin);
        estado.horaIni = formatoHora(estado.retIni);
        estado.horaFin = formatoHora(estado.retIni + dur);
        // El contorno-preview muestra el TROZO agarrado en su nueva posición: se re-segmenta el turno
        // desplazado y se coge el trozo de la celda agarrada (correcto también cerca del borde, donde un
        // desplazamiento naíf del trozo mentiría porque el tajo se re-ancla a la ventana).
        const desplazado = { ...t, iniMin: estado.retIni, finMin: estado.retIni + dur };
        const propio = segmentar([desplazado], DIAS).find((s) => s.dia === estado.seg.dia);
        estado.retSeg = propio ? { iniMin: propio.iniLocal, finMin: propio.finLocal } : null;
    } else {
        estado.retIni = null;
        estado.retSeg = null;
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
    estado.seg = null;
    estado.destino = null;
    estado.modo = null;
    estado.retIni = null;
    estado.retSeg = null;
    estado.horaIni = '';
    estado.horaFin = '';
    candidato = null;
    candidatoSeg = null;
    window.removeEventListener('pointermove', alMover);
    window.removeEventListener('pointerup', alSoltar);
    window.removeEventListener('pointercancel', limpiar);
    window.removeEventListener('keydown', alTecla);
}

/** Coge un TROZO. `seg` = { dia, iniLocal, finLocal, corteIni, corteFin } del trozo agarrado: su `dia`
 *  es la celda contra la que se decide retimar/reubicar (NO turno.dia). */
function alCoger(e, turno, seg) {
    if (e.button != null && e.button !== 0) return; // solo botón principal
    const r = e.currentTarget.getBoundingClientRect();
    candidato = turno;
    candidatoSeg = seg;
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
