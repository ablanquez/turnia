import { describe, test, expect } from 'vitest';
import { modoArrastre } from './useArrastre.js';

/*
 * Tests del MODO de arrastre (Bloque 4 · 2.d · PC2). La decisión retimar/reubicar se toma contra la
 * celda DEL TROZO agarrado, no contra turno.dia. El test que más pesa: retimar la COLA de un turno
 * partido —que vive en otro día que el turno— debe RETIMAR, no reubicar. Nació viendo su rojo.
 */

// Iker partido: turno del JUEVES (cabeza Jue 22:00–06:00, cola Vie 06:00–07:00), puesto cocina.
const turno = { dia: 'jue', puesto: 'cocina' };
const segCabeza = { dia: 'jue' }; // el trozo de cabeza vive en el día del turno
const segCola = { dia: 'vie' };   // ⚠️ el trozo de cola vive en OTRO día que el turno

describe('modoArrastre', () => {
    test('sin destino (fuera de toda celda) → null', () => {
        expect(modoArrastre(null, segCabeza, turno)).toBe(null);
    });

    test('cabeza dentro de su celda (Jue) → retimar', () => {
        expect(modoArrastre({ dia: 'jue', puesto: 'cocina' }, segCabeza, turno)).toBe('retimar');
    });

    test('⭐ COLA dentro de su propia celda (Vie) → RETIMAR (no reubica aunque Vie ≠ turno.dia)', () => {
        // El fallo silencioso: comparar con turno.dia (Jue) daría 'reubicar' y el turno se mudaría de día.
        expect(modoArrastre({ dia: 'vie', puesto: 'cocina' }, segCola, turno)).toBe('retimar');
    });

    test('cola arrastrada a OTRO puesto (Vie·sala) → reubicar', () => {
        expect(modoArrastre({ dia: 'vie', puesto: 'sala' }, segCola, turno)).toBe('reubicar');
    });

    test('cola arrastrada a OTRO día (Mié) → reubicar (mueve el turno entero)', () => {
        expect(modoArrastre({ dia: 'mie', puesto: 'cocina' }, segCola, turno)).toBe('reubicar');
    });

    test('CASO CRUZADO: cola (Vie) soltada en el día de la cabeza (Jue) → reubicar (será no-op en mover)', () => {
        // Cae de la regla general: Jue ≠ segCola.dia (Vie) → reubicar; y mover a Jue, donde ya está, no cambia nada.
        expect(modoArrastre({ dia: 'jue', puesto: 'cocina' }, segCola, turno)).toBe('reubicar');
    });
});
