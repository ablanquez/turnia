import { describe, test, expect } from 'vitest';
import { minutos, normaliza, calcularEje, posicion, marcasHoras } from './useEje.js';

/*
 * Tests de la lógica temporal. Reglas del método (punto 3 del Bloque 3.5):
 *   · Cada test nació viendo su ROJO (contraprueba: se reintrodujo el fallo y se comprobó que salta).
 *   · Los valores esperados están calculados A MANO como literales — testigo independiente, no espejo
 *     de la fórmula del código. Si el test replicara la fórmula, ambos compartirían el error.
 *   · Se prueba comportamiento, y se buscan los BORDES (06:00 exacto, cruce de medianoche, ensanche).
 */

describe('minutos', () => {
    test('convierte HH:MM a minutos desde medianoche, con minutos NO redondos', () => {
        expect(minutos('06:30')).toBe(390); // 6·60 + 30, a mano
        expect(minutos('00:00')).toBe(0);
        expect(minutos('23:59')).toBe(1439); // 23·60 + 59
    });
});

describe('normaliza', () => {
    test('conserva inicio/fin como CADENAS HH:MM y añade iniMin/finMin aparte (el bug 08:00–960)', () => {
        const t = normaliza({ persona: 'x', inicio: '08:00', fin: '16:00' });
        expect(t.inicio).toBe('08:00');
        expect(t.fin).toBe('16:00');   // ⚠️ la cadena "16:00" NO se pisa con los minutos
        expect(t.iniMin).toBe(480);    // 8·60
        expect(t.finMin).toBe(960);    // 16·60
    });

    test('un turno normal (fin > inicio) NO cruza medianoche', () => {
        const t = normaliza({ inicio: '08:00', fin: '16:00' });
        expect(t.finMin).toBe(960); // sin +24h
    });

    test('un turno que cruza medianoche lleva el fin al día siguiente (+24h)', () => {
        const t = normaliza({ inicio: '22:00', fin: '06:00' });
        expect(t.iniMin).toBe(1320);   // 22·60
        expect(t.finMin).toBe(1800);   // 06:00 del día siguiente = 30:00 = 30·60
    });
});

describe('calcularEje', () => {
    test('por defecto abarca 06:00 → 06:00 (360 → 1800)', () => {
        const eje = calcularEje([normaliza({ inicio: '08:00', fin: '16:00' })]);
        expect(eje.desde).toBe(360);
        expect(eje.hasta).toBe(1800);
    });

    test('un turno que empieza EXACTAMENTE a las 06:00 no ensancha (borde)', () => {
        const eje = calcularEje([normaliza({ inicio: '06:00', fin: '14:00' })]);
        expect(eje.desde).toBe(360); // 06:00 es el borde: no baja de ahí
    });

    test('se ensancha por la IZQUIERDA si un turno empieza antes de 06:00 (panadería 04:00)', () => {
        const eje = calcularEje([normaliza({ inicio: '04:00', fin: '12:00' })]);
        expect(eje.desde).toBe(240);   // 04:00
        expect(eje.hasta).toBe(1800);  // el otro lado no se mueve
    });

    test('un turno que acaba EXACTAMENTE a las 06:00 del día siguiente no ensancha (borde)', () => {
        const eje = calcularEje([normaliza({ inicio: '22:00', fin: '06:00' })]);
        expect(eje.hasta).toBe(1800); // 30:00 es el borde: no sube de ahí
    });

    test('se ensancha por la DERECHA si un turno acaba después de 06:00 del día siguiente', () => {
        const eje = calcularEje([normaliza({ inicio: '20:00', fin: '07:00' })]);
        expect(eje.desde).toBe(360);
        expect(eje.hasta).toBe(1860);  // 07:00 del día siguiente = 31:00 = 31·60
    });
});

describe('posicion', () => {
    test('left% y width% de un turno dentro del eje (valores a mano)', () => {
        const eje = { desde: 360, hasta: 1800 };       // total 1440 min = 24 h
        const p = posicion({ iniMin: 720, finMin: 1200 }, eje); // 12:00 → 20:00
        // left = (720-360)/1440 = 360/1440 = 1/4 = 25 %
        expect(p.left).toBeCloseTo(25, 5);
        // width = (1200-720)/1440 = 480/1440 = 1/3 = 33,33… %
        expect(p.width).toBeCloseTo(33.333, 2);
    });

    test('un turno que empieza en el borde izquierdo del eje va a left 0', () => {
        const eje = { desde: 240, hasta: 1800 };
        const p = posicion({ iniMin: 240, finMin: 720 }, eje); // empieza en el desde
        expect(p.left).toBeCloseTo(0, 5);
    });
});

describe('marcasHoras (las etiquetas de hora en horas redondas)', () => {
    const etiquetas = (m) => m.map((x) => x.etiqueta);

    test('caen en horas redondas de 6 h con el eje por defecto', () => {
        expect(etiquetas(marcasHoras({ desde: 360, hasta: 1800 }, 6)))
            .toEqual(['06:00', '12:00', '18:00', '00:00']);
    });

    test('SIGUEN cayendo en horas redondas con el eje ENSANCHADO (el caso donde se rompería)', () => {
        // eje desde 04:00 (240): la primera marca redonda es 06:00, no 04:00
        expect(etiquetas(marcasHoras({ desde: 240, hasta: 1800 }, 6)))
            .toEqual(['06:00', '12:00', '18:00', '00:00']);
    });
});
