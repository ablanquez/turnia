import { describe, test, expect } from 'vitest';
import { editarTurno, borrarTurno, DURACION_MINIMA } from './editarTurno.js';
import { normaliza } from './useEje.js';

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

    test('GUARDA: pedir duración CERO sale a la mínima (media hora), NUNCA cero ni 24 h', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 480, finMin: 480, dia: '2026-07-13', puesto: 'barra' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('08:00');
        expect(a.fin).toBe('08:30');       // +30, no "08:00" (que normaliza leería como 24 h)
        expect(dur(a)).toBe(DURACION_MINIMA); // 30, ni 0 ni 1440
    });

    test('GUARDA: duración < mínima sube a la mínima', () => {
        const r = editarTurno(SEMILLA, 'a', { iniMin: 480, finMin: 490, dia: '2026-07-13', puesto: 'barra' }); // 10 min
        expect(dur(r.find((t) => t.id === 'a'))).toBe(30);
    });

    test('GUARDA con CRUCE DE MEDIANOCHE: un fin apenas pasado del inicio de un turno nocturno sube a la mínima', () => {
        // inicio 20:00 (1200), fin pedido 20:10 (1210) → 10 min → sube a 30
        const r = editarTurno(SEMILLA, 'a', { iniMin: 1200, finMin: 1210, dia: '2026-07-13', puesto: 'barra' });
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('20:00');
        expect(a.fin).toBe('20:30');
        expect(dur(a)).toBe(30);
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
