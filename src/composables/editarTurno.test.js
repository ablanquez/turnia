import { describe, test, expect } from 'vitest';
import { editarTurno, borrarTurno, DURACION_MINIMA, horaAAbsoluto, acotaInicio, acotaFin } from './editarTurno.js';
import { normaliza, ajustaGranularidad } from './useEje.js';

/*
 * Tests del editor (Bloque 4 · tanda 2.b). Método: cada uno nació viendo su rojo.
 * El test que más pesa es la GUARDA DE DURACIÓN MÍNIMA: que por ningún argumento —incluido el cruce
 * de medianoche— salga un turno de menos de media hora (ni de cero).
 */
const SEMILLA = Object.freeze([
    Object.freeze({ id: 'a', persona: 'ana', puesto: 'barra', dia: '2026-07-13', inicio: '08:00', fin: '16:00' }),
    Object.freeze({ id: 'b', persona: 'bea', puesto: 'cocina', dia: '2026-07-14', inicio: '10:00', fin: '18:00' }),
]);
const dur = (t) => { const n = normaliza(t); return n.finMin - n.iniMin; };

describe('editarTurno', () => {
    test('fija horas (min absolutos), día y puesto', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 600, finMin: 1080, dia: '2026-07-15', puesto: 'sala' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('10:00');
        expect(a.fin).toBe('18:00');
        expect(a.dia).toBe('2026-07-15');
        expect(a.puesto).toBe('sala');
    });

    test('GUARDA: pedir duración CERO sale a la mínima (5 min), NUNCA cero ni 24 h', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 480, finMin: 480, dia: '2026-07-13', puesto: 'barra' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('08:00');
        expect(a.fin).toBe('08:05');       // +5, no "08:00" (que normaliza leería como 24 h)
        expect(dur(a)).toBe(DURACION_MINIMA); // 5, ni 0 ni 1440
    });

    test('GUARDA: duración < mínima sube a la mínima', () => {
        // 3 min (< 5, la mínima de la 2.c). Antes la entrada eran 10 min, pero 10 ≥ 5 ya es VÁLIDA:
        // habría dejado de probar la guarda. Se baja por debajo del suelo nuevo para seguir cazándola.
        const r = editarTurno(SEMILLA, 'a', { iniMin: 480, finMin: 483, dia: '2026-07-13', puesto: 'barra' }); // 3 min
        expect(dur(r.find((t) => t.id === 'a'))).toBe(DURACION_MINIMA); // 5
    });

    test('GUARDA con CRUCE DE MEDIANOCHE: un fin apenas pasado del inicio de un turno nocturno sube a la mínima', () => {
        // inicio 20:00 (1200), fin pedido 20:03 (1203) → 3 min (< 5) → sube a la mínima
        const r = editarTurno(SEMILLA, 'a', { iniMin: 1200, finMin: 1203, dia: '2026-07-13', puesto: 'barra' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('20:00');
        expect(a.fin).toBe('20:05');
        expect(dur(a)).toBe(DURACION_MINIMA); // 5
    });

    test('un cruce de medianoche VÁLIDO se conserva (20:00 → 04:00 = 8 h)', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 1200, finMin: 1680, dia: '2026-07-13', puesto: 'barra' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('20:00');
        expect(a.fin).toBe('04:00');
        expect(dur(a)).toBe(480);
    });

    test('GUARDA: duración por encima de 24 h se topa en 24 h', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 480, finMin: 480 + 2000, dia: '2026-07-13', puesto: 'barra' });
        expect(dur(r.find((t) => t.id === 'a'))).toBe(1440);
    });

    test('NO muta el array ni los objetos originales', () => {
        const antes = JSON.parse(JSON.stringify(SEMILLA));
        const r = editarTurno(SEMILLA, 'a', { iniMin: 600, finMin: 1080, dia: '2026-07-13', puesto: 'barra' });
        expect(r).not.toBe(SEMILLA);
        expect(SEMILLA).toEqual(antes);
    });
});

/*
 * EL MURO POR TECLADO (Bloque 4 · tanda 2.c). Toda la protección anti-duración-cero vivía en los
 * tiradores; el teclado es un camino de entrada NUEVO. Estos tests prueban el muro compartido tal como
 * lo aplica escribirInicio/escribirFin: horaAAbsoluto (reloj → minuto absoluto, cruce solo) + acota*.
 * Cada uno nació viendo su rojo (se documenta el rojo al lado).
 */
const EJE = { desde: 360, hasta: 1800 }; // 06→06, el eje por defecto de un turno que cabe en el día
// Replica exacta de lo que hace escribirFin/escribirInicio en useEditor, para probar EL CAMINO DE TECLADO.
const tecleaFin = (clock, borr) => acotaFin(horaAAbsoluto(clock, 'fin', borr), borr);
const tecleaInicio = (clock, borr) => acotaInicio(horaAAbsoluto(clock, 'inicio', borr), borr);

describe('el muro por TECLADO (2.c)', () => {
    test('GUARDA teclado: un fin 3 min tras el inicio SUBE a la mínima (5), no queda en 3', () => {
        // inicio 20:00 (1200), fin tecleado 20:03 (1203) = 3 min. Sin el suelo de acotaFin quedaría 3.
        const borr = { iniMin: 1200, finMin: 1500, eje: EJE };
        const { finMin, topado } = tecleaFin(1203, borr);
        expect(finMin - borr.iniMin).toBe(DURACION_MINIMA); // 5, no 3 → ROJO sin el muro: "expected 3 to be 5"
        expect(topado).toBe('fin');
    });

    test('CRUCE por teclado se resuelve solo: fin de reloj ANTES del inicio cruza medianoche (22:00→06:00 = 8 h)', () => {
        // Sin el levantado +1440 de horaAAbsoluto, 06:00 (360) < 20:00... el turno colapsaría a la mínima.
        const borr = { iniMin: 1320, finMin: 1800, eje: EJE }; // 22:00, actualmente hasta 06:00
        const { finMin } = tecleaFin(360, borr); // teclea fin 06:00
        expect(finMin).toBe(1800);               // 06:00 del día siguiente, no 360
        expect(finMin - borr.iniMin).toBe(480);  // 8 h intactas → ROJO sin el levantado: dur colapsada a 5
    });

    test('GUARDA teclado CON CRUCE: un fin apenas pasada la medianoche sube a la mínima y sigue cruzando', () => {
        // inicio 23:59 (1439), fin tecleado 00:01 (1) → levanta a 1441, muro lo sube a 1444 (00:04).
        const borr = { iniMin: 1439, finMin: 1800, eje: EJE };
        const { finMin } = tecleaFin(1, borr);
        expect(finMin - borr.iniMin).toBe(DURACION_MINIMA); // 5, no 2 → ROJO sin el muro: "expected 2 to be 5"
        expect(finMin).toBeGreaterThan(1440);               // sigue siendo un cruce de medianoche
    });

    test('el TECLADO afina al minuto (10:07 se conserva); el ARRASTRE snapea (10:07 → 10:00)', () => {
        const borr = { iniMin: 480, finMin: 960, eje: EJE }; // 08:00–16:00
        expect(tecleaInicio(607, borr).iniMin).toBe(607);    // teclado NO redondea: 10:07 intacto
        expect(ajustaGranularidad(607)).toBe(600);           // arrastre SÍ: cae en múltiplo de 15 (10:00)
    });
});

describe('borrarTurno', () => {
    test('quita ese turno y deja los demás; array nuevo', () => {
        const r = borrarTurno(SEMILLA, 'a');
        expect(r.map((t) => t.id)).toEqual(['b']);
        expect(r).not.toBe(SEMILLA);
        expect(SEMILLA.length).toBe(2); // el original intacto
    });

    test('id desconocido = no-op (misma referencia)', () => {
        expect(borrarTurno(SEMILLA, 'zzz')).toBe(SEMILLA);
    });
});
