import { describe, test, expect } from 'vitest';
import { moverTurno } from './moverTurno.js';
import { normaliza, calcularEje } from './useEje.js';

/*
 * Tests de la lógica de mover un turno (Bloque 4 · tanda 1). Reglas del método (heredadas del 3.5):
 *   · Cada test nació viendo su ROJO — se reintrodujo su fallo en moverTurno y se comprobó que salta.
 *   · Se prueba COMPORTAMIENTO (mueve, conserva, no muta), no la implementación.
 *   · Los esperados son literales calculados a mano (testigo independiente).
 *
 * La semilla se congela con Object.freeze: si moverTurno intentara mutar en sitio, `freeze` lo
 * convierte en error en modo estricto — cinturón además del tirante del test de inmutabilidad.
 */
const SEMILLA = Object.freeze([
    Object.freeze({ id: 'a', persona: 'ana', puesto: 'barra', dia: '2026-07-13', inicio: '08:00', fin: '16:00' }),
    Object.freeze({ id: 'b', persona: 'bea', puesto: 'cocina', dia: '2026-07-14', inicio: '10:00', fin: '18:00' }),
]);

describe('moverTurno', () => {
    test('mueve: cambia día y puesto del turno señalado, y solo de ese', () => {
        const r = moverTurno(SEMILLA, 'a', { dia: '2026-07-15', puesto: 'sala' });
        const a = r.find((t) => t.id === 'a');
        expect(a.dia).toBe('2026-07-15');
        expect(a.puesto).toBe('sala');
        // el otro turno intacto
        const b = r.find((t) => t.id === 'b');
        expect(b.dia).toBe('2026-07-14');
        expect(b.puesto).toBe('cocina');
    });

    test('conserva persona/inicio/fin al mover (cambia de sitio, no de duración)', () => {
        const r = moverTurno(SEMILLA, 'a', { dia: '2026-07-15', puesto: 'sala' });
        const a = r.find((t) => t.id === 'a');
        expect(a.persona).toBe('ana');
        expect(a.inicio).toBe('08:00');
        expect(a.fin).toBe('16:00');
    });

    test('NO muta el array ni los objetos originales (el fallo más traicionero)', () => {
        const antes = JSON.parse(JSON.stringify(SEMILLA));
        const r = moverTurno(SEMILLA, 'a', { dia: '2026-07-15', puesto: 'sala' });
        expect(r).not.toBe(SEMILLA);              // devuelve un array NUEVO
        expect(SEMILLA).toEqual(antes);            // el original, byte a byte, intacto
        expect(SEMILLA[0].dia).toBe('2026-07-13'); // explícito: el turno 'a' no se movió en la fuente
    });

    test('mover a la MISMA celda es un no-op de verdad (devuelve la misma referencia)', () => {
        const r = moverTurno(SEMILLA, 'a', { dia: '2026-07-13', puesto: 'barra' });
        expect(r).toBe(SEMILLA); // ni array nuevo ni re-render: nada cambió
    });

    test('id desconocido = no-op (no inventa ni rompe nada)', () => {
        const r = moverTurno(SEMILLA, 'zzz', { dia: '2026-07-15', puesto: 'sala' });
        expect(r).toBe(SEMILLA);
    });

    test('el eje NO cambia tras mover (mismas horas reubicadas → misma escala)', () => {
        const ejeAntes = calcularEje(SEMILLA.map(normaliza));
        const r = moverTurno(SEMILLA, 'a', { dia: '2026-07-19', puesto: 'sala' });
        const ejeDespues = calcularEje(r.map(normaliza));
        expect(ejeDespues.desde).toBe(ejeAntes.desde); // 360, sin desplazar
        expect(ejeDespues.hasta).toBe(ejeAntes.hasta); // 1800, sin desplazar
    });
});
