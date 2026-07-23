/*
 * LA SEMANA A FUEGO — personas, puestos y turnos de ejemplo.
 *
 * Sin motor, sin login, sin BD. Solo lo justo para ver la parrilla poblada y medir la geometría.
 *
 * ⚠️ EL PEOR CASO GEOMÉTRICO NACE SEMBRADO (ESTILO.md lo dejó anotado):
 *   · Elena Gil = Persona 05 (#C484FC), la del margen más ajustado del sistema, lleva en la MISMA
 *     celda (Barra · Lun) un turno de 8 h y otro de 1 h. Mismo color en ancho y en estrecho, listo
 *     para comparar el píxel real.
 *   · Carlos entra a las 04:00 (panadería): antes del arranque de la jornada (06:00) → su turno se
 *     PARTE hacia el día anterior (2.d, ley nueva). En el demo cae el lunes, así que su cola
 *     (04:00–06:00) queda off-view; se ve su cuerpo 06:00–12:00 con el borde de tajo.
 *
 * En este bloque el relleno es plano (sin borde de gravedad): R = 0. La barra estrecha ya está en
 * pantalla, pero el peor caso DE VERDAD —barra estrecha CON borde que se come el ancho— no existe
 * hasta que llegue el motor.
 */
import { colorDe } from './paleta.js';

export const DIAS = [
    { clave: '2026-07-13', etiqueta: 'Lun', numero: 13 },
    { clave: '2026-07-14', etiqueta: 'Mar', numero: 14 },
    { clave: '2026-07-15', etiqueta: 'Mié', numero: 15 },
    { clave: '2026-07-16', etiqueta: 'Jue', numero: 16 },
    { clave: '2026-07-17', etiqueta: 'Vie', numero: 17 },
    { clave: '2026-07-18', etiqueta: 'Sáb', numero: 18 },
    { clave: '2026-07-19', etiqueta: 'Dom', numero: 19 },
];

export const PUESTOS = [
    { id: 'barra', nombre: 'Barra' },
    { id: 'cocina', nombre: 'Cocina' },
    { id: 'caja', nombre: 'Caja' },
    { id: 'sala', nombre: 'Sala' },
];

const PERSONAS = [
    { id: 'ana', nombre: 'Ana Ruiz', indice: 0 },
    { id: 'bea', nombre: 'Bea Soler', indice: 1 },
    { id: 'carlos', nombre: 'Carlos Vega', indice: 2 },
    { id: 'diego', nombre: 'Diego Mora', indice: 3 },
    { id: 'elena', nombre: 'Elena Gil', indice: 4 }, // Persona 05 · #C484FC · el peor caso
    { id: 'iker', nombre: 'Iker Blanco', indice: 5 },
    { id: 'maricarmen', nombre: 'María del Carmen Gutiérrez Villanueva', indice: 6 }, // nombre largo: ejercita el ajuste (envolver, NO truncar)
];

export const PERSONAS_POR_ID = Object.fromEntries(
    PERSONAS.map((p) => [p.id, { ...p, color: colorDe(p.indice) }]),
);

/*
 * Cada turno lleva un `id` ESTABLE y único. Es la identidad por la que el arrastre (Bloque 4) mueve
 * una ficha concreta: identificar por índice del array se rompe en cuanto algo se mueve (el índice
 * cambia), así que el id es la opción fail-closed. Es dato, no lógica: vive con el turno.
 */
export const TURNOS = [
    // ── EL PEOR CASO: Elena (Persona 05) con 8 h y 1 h en la misma celda ──────────────
    { id: 't-elena-1', persona: 'elena', puesto: 'barra', dia: '2026-07-13', inicio: '06:00', fin: '14:00' },
    { id: 't-elena-2', persona: 'elena', puesto: 'barra', dia: '2026-07-13', inicio: '15:00', fin: '16:00' }, // 1 h

    // ── LA PANADERÍA: 04:00, antes del arranque → parte hacia el día anterior (2.d) ────
    { id: 't-carlos-1', persona: 'carlos', puesto: 'cocina', dia: '2026-07-13', inicio: '04:00', fin: '12:00' },

    // ── El resto, 8 h, para poblar la rejilla ─────────────────────────────────────────
    { id: 't-ana-1', persona: 'ana', puesto: 'barra', dia: '2026-07-14', inicio: '08:00', fin: '16:00' },
    { id: 't-bea-1', persona: 'bea', puesto: 'barra', dia: '2026-07-16', inicio: '14:00', fin: '22:00' },
    { id: 't-iker-1', persona: 'iker', puesto: 'cocina', dia: '2026-07-14', inicio: '10:00', fin: '18:00' },
    { id: 't-diego-1', persona: 'diego', puesto: 'cocina', dia: '2026-07-15', inicio: '12:00', fin: '20:00' },
    { id: 't-ana-2', persona: 'ana', puesto: 'caja', dia: '2026-07-13', inicio: '09:00', fin: '17:00' },
    { id: 't-bea-2', persona: 'bea', puesto: 'caja', dia: '2026-07-15', inicio: '09:00', fin: '17:00' },
    { id: 't-iker-2', persona: 'iker', puesto: 'caja', dia: '2026-07-17', inicio: '13:00', fin: '21:00' },
    { id: 't-diego-2', persona: 'diego', puesto: 'sala', dia: '2026-07-14', inicio: '08:00', fin: '16:00' },
    { id: 't-elena-3', persona: 'elena', puesto: 'sala', dia: '2026-07-17', inicio: '10:00', fin: '18:00' },
    { id: 't-carlos-2', persona: 'carlos', puesto: 'sala', dia: '2026-07-18', inicio: '11:00', fin: '19:00' },

    // ── CASOS LÍMITE sembrados en el Bloque 3.5 (punto 4) ─────────────────────────────
    // CRUZA MEDIANOCHE: 22:00 → 06:00. normaliza() suma 24h (finMin 1800 = 06:00 del día siguiente).
    // Con la ventana fija (2.d) acaba EXACTO en el borde (E+1440=1800) → es el caso BORDE-EXACTO: un
    // solo trozo, NO se parte. Para ver un partido-adelante hace falta un fin pasado de 06:00 (aún sin sembrar).
    { id: 't-diego-3', persona: 'diego', puesto: 'cocina', dia: '2026-07-17', inicio: '22:00', fin: '06:00' },
    // SOLAPE DE DOS en la misma celda (Barra · Mié): se pisan de 14:00 a 18:00. Cada turno en su
    // propia ficha apilada, SIN tratamiento visual especial: la semántica del solape llega con el motor.
    { id: 't-ana-3', persona: 'ana', puesto: 'barra', dia: '2026-07-15', inicio: '10:00', fin: '18:00' },
    { id: 't-bea-3', persona: 'bea', puesto: 'barra', dia: '2026-07-15', inicio: '14:00', fin: '22:00' },
    // NOMBRE LARGO (Sala · Mié): activa el ajuste del nombre en la ficha (envolver, no truncar).
    { id: 't-maricarmen-1', persona: 'maricarmen', puesto: 'sala', dia: '2026-07-15', inicio: '09:00', fin: '17:00' },
];
