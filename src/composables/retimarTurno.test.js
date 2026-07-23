import { describe, test, expect } from 'vitest';
import { retimarTurno } from './retimarTurno.js';
import { normaliza } from './useEje.js';

/*
 * Tests de retimar un turno (Bloque 4 · tanda 2). Método (heredado): cada uno nació viendo su rojo.
 * La semilla congelada convierte cualquier mutación en sitio en un throw (cinturón + tirante).
 */
const SEMILLA = Object.freeze([
    Object.freeze({ id: 'a', persona: 'ana', puesto: 'barra', dia: '2026-07-13', inicio: '08:00', fin: '16:00' }), // 8 h
    Object.freeze({ id: 'b', persona: 'bea', puesto: 'cocina', dia: '2026-07-14', inicio: '10:00', fin: '18:00' }),
]);

describe('retimarTurno', () => {
    test('desplaza inicio Y fin conservando la duración (8 h siguen siendo 8 h)', () => {
        const r = retimarTurno(SEMILLA, 'a', 600); // nuevo inicio 10:00
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('10:00');
        expect(a.fin).toBe('18:00'); // 10:00 + 8 h
        expect(a.persona).toBe('ana'); // identidad intacta
    });

    test('un retimado que EMPUJA el fin más allá de medianoche lo deja como cruce (fin < inicio)', () => {
        const r = retimarTurno(SEMILLA, 'a', 1200); // 20:00 + 8 h = 04:00 del día siguiente
        const a = r.find((t) => t.id === 'a');
        expect(a.inicio).toBe('20:00');
        expect(a.fin).toBe('04:00'); // NO "28:00": es hora del día (mod 24h)
        // y normaliza lo entiende como cruce de medianoche, con la duración intacta (480 min)
        const n = normaliza(a);
        expect(n.finMin - n.iniMin).toBe(480);
    });

    test('NO muta el array ni los objetos originales', () => {
        const antes = JSON.parse(JSON.stringify(SEMILLA));
        const r = retimarTurno(SEMILLA, 'a', 600);
        expect(r).not.toBe(SEMILLA);
        expect(SEMILLA).toEqual(antes);
        expect(SEMILLA[0].inicio).toBe('08:00');
    });

    test('no toca los demás turnos', () => {
        const r = retimarTurno(SEMILLA, 'a', 600);
        const b = r.find((t) => t.id === 'b');
        expect(b.inicio).toBe('10:00');
        expect(b.fin).toBe('18:00');
    });

    test('retimar al MISMO inicio es un no-op (devuelve la misma referencia)', () => {
        const r = retimarTurno(SEMILLA, 'a', 480); // 08:00, donde ya está
        expect(r).toBe(SEMILLA);
    });

    test('id desconocido = no-op', () => {
        expect(retimarTurno(SEMILLA, 'zzz', 600)).toBe(SEMILLA);
    });
});
