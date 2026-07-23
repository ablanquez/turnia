import { describe, test, expect } from 'vitest';
import { minutos, normaliza, segmentar, ejeEditor, EJE_DIA, posicion, marcasHoras, ajustaGranularidad, minutosEnX } from './useEje.js';

/*
 * Tests de la lógica temporal. Reglas del método (punto 3 del Bloque 3.5):
 *   · Cada test nació viendo su ROJO (contraprueba: se reintrodujo el fallo y se comprobó que salta).
 *   · Los valores esperados están calculados A MANO como literales — testigo independiente, no espejo
 *     de la fórmula del código. Si el test replicara la fórmula, ambos compartirían el error.
 *   · Se prueba comportamiento, y se buscan los BORDES (06:00 exacto, cruce de medianoche, el partido).
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

/*
 * EL EJE FIJO Y `segmentar` (Bloque 4 · 2.d). SUSTITUYEN al bloque `calcularEje`, que se RETIRÓ entero:
 * el eje ya no se ensancha (esos 6 tests probaban ensanche izq/der/borde de una ley DEROGADA; ver
 * bitácora). Lo que ahora hay que probar es que la ventana es fija y que segmentar parte bien.
 */
describe('el eje fijo de 24 h', () => {
    test('mide SIEMPRE 1440 min (24 h): la ventana no se ensancha', () => {
        expect(EJE_DIA.hasta - EJE_DIA.desde).toBe(1440);
    });
    test('ejeEditor devuelve una ventana de 24 h que contiene el turno entero (aunque se salga)', () => {
        const cabe = ejeEditor(480, 960, 360);          // 08:00–16:00, cabe en 06→06
        expect(cabe).toEqual({ desde: 360, hasta: 1800 });
        const cruza = ejeEditor(1320, 1920, 360);       // 22:00–08:00, se sale → ancla al inicio
        expect(cruza.hasta - cruza.desde).toBe(1440);
        expect(cruza.desde).toBe(1320);                 // contiene el turno entero sin partir
    });
});

describe('segmentar (un turno → 1 ó 2 trozos, ventana fija)', () => {
    const DIAS = [{ clave: 'd0', etiqueta: 'Lun' }, { clave: 'd1', etiqueta: 'Mar' }, { clave: 'd2', etiqueta: 'Dom' }];
    const E = 360; // 06:00, pasado explícito: testigo independiente de la config del negocio
    const turno = (dia, iniMin, finMin) => ({ id: 't', persona: 'x', puesto: 'barra', dia, iniMin, finMin });
    const dur = (s) => s.finLocal - s.iniLocal;

    test('un turno que cabe en su ventana → UN trozo, sin cortes', () => {
        const s = segmentar([turno('d1', 480, 960)], DIAS, E); // 08:00–16:00
        expect(s).toHaveLength(1);
        expect(s[0]).toMatchObject({ dia: 'd1', iniLocal: 480, finLocal: 960, corteIni: false, corteFin: false });
    });

    test('CORTE ADELANTE: los dos trozos SUMAN la duración (22:00–08:00 = 10 h)', () => {
        const s = segmentar([turno('d1', 1320, 1920)], DIAS, E); // 22:00 → 08:00 del día siguiente (600 min)
        expect(s).toHaveLength(2);
        const d1 = s.find((x) => x.dia === 'd1'), d2 = s.find((x) => x.dia === 'd2');
        expect(dur(d1) + dur(d2)).toBe(600); // ⚠️ LA ASERCIÓN CLAVE: el tajo no pierde ni inventa tiempo
        expect(d1).toMatchObject({ iniLocal: 1320, finLocal: 1800, corteFin: true, corteIni: false }); // 22:00 → 06:00
        expect(d2).toMatchObject({ iniLocal: 360, finLocal: 480, corteIni: true, corteFin: false });    // 06:00 → 08:00
    });

    test('CORTE ATRÁS (simétrico): un inicio antes de E parte hacia el día anterior (04:00–12:00)', () => {
        const s = segmentar([turno('d1', 240, 720)], DIAS, E); // 04:00 → 12:00 (480 min)
        expect(s).toHaveLength(2);
        const d0 = s.find((x) => x.dia === 'd0'), d1 = s.find((x) => x.dia === 'd1');
        expect(d0).toMatchObject({ iniLocal: 1680, finLocal: 1800, corteFin: true });  // 04:00 → 06:00, cola del día anterior
        expect(d1).toMatchObject({ iniLocal: 360, finLocal: 720, corteIni: true });     // 06:00 → 12:00
        expect(dur(d0) + dur(d1)).toBe(480);
    });

    test('BORDE EXACTO: un fin justo en E+1440 NO parte (22:00–06:00 = un trozo)', () => {
        const s = segmentar([turno('d1', 1320, 1800)], DIAS, E); // acaba EXACTO en 06:00 del día siguiente
        expect(s).toHaveLength(1);
        expect(s[0]).toMatchObject({ dia: 'd1', corteFin: false, corteIni: false });
    });

    test('OFF-VIEW: el trozo que cae en un día fuera de la semana se marca offView (no se pierde)', () => {
        const s = segmentar([turno('d0', 240, 720)], DIAS, E); // primer día, parte hacia el día -1 (fuera)
        expect(s).toHaveLength(2);
        expect(s.find((x) => x.offView)).toMatchObject({ dia: null, diaIndex: -1 });
        expect(s.find((x) => !x.offView)).toMatchObject({ dia: 'd0', corteIni: true });
    });

    // ── La NOTA de continuación: SOLO cuando el otro trozo está fuera de la vista (bordes). ──
    test('NOTA: un trozo del borde cuyo otro trozo está FUERA lleva notaFuera (viene de antes / va después)', () => {
        const atras = segmentar([turno('d0', 240, 720)], DIAS, E).find((x) => !x.offView); // 04:00 en el día 0
        expect(atras.notaFuera).toEqual({ dir: 'antes', dia: 'Dom' }); // su cola cae en el día anterior a d0 (Dom)
        const adelante = segmentar([turno('d2', 1320, 1920)], DIAS, E).find((x) => !x.offView); // 22:00→08:00 en el último día
        expect(adelante.notaFuera).toEqual({ dir: 'despues', dia: 'Lun' }); // sigue en el día posterior a d2 (Lun)
    });

    test('NOTA: un partido INTERIOR (los dos trozos visibles) NO lleva nota — ya lo estás viendo', () => {
        const s = segmentar([turno('d1', 1320, 1920)], DIAS, E); // 22:00→08:00 en d1 → d1 y d2, ambos visibles
        expect(s).toHaveLength(2);
        expect(s.every((x) => x.notaFuera === null)).toBe(true); // ⚠️ ROJO si la nota ignora el borde
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

describe('ajustaGranularidad (el snap de 15 min del arrastre)', () => {
    // El grano bajó de 30 a 15 en la 2.c: el arrastre aproxima más fino. Testigos recalculados a mano
    // para el grano 15; siguen probando lo mismo (REDONDEA al múltiplo más cercano, NO trunca).
    test('redondea al múltiplo de 15 más cercano, NO trunca (valores a mano)', () => {
        expect(ajustaGranularidad(600)).toBe(600); // ya en la rejilla (10:00)
        expect(ajustaGranularidad(607)).toBe(600); // 10:07 → 10:00 (607/15 = 40,47 → 40 → 600)
        expect(ajustaGranularidad(608)).toBe(615); // 10:08 → 10:15 (608/15 = 40,53 → 41 → 615) ⚠️ trunca daría 600
        expect(ajustaGranularidad(683)).toBe(690); // 11:23 → 11:30 (683/15 = 45,53 → 46 → 690) ⚠️ trunca daría 675
    });
});

describe('minutosEnX (px → minutos, la inversa que el retimado necesita)', () => {
    test('mapea la x relativa dentro de la pista al instante del eje (valores a mano)', () => {
        const eje = { desde: 360, hasta: 1800 }; // span 1440; con ancho 144 → 10 min/px
        expect(minutosEnX(eje, 0, 144)).toBe(360);    // borde izquierdo = eje.desde (06:00)
        expect(minutosEnX(eje, 144, 144)).toBe(1800); // borde derecho = eje.hasta
        expect(minutosEnX(eje, 72, 144)).toBe(1080);  // mitad = 18:00
        expect(minutosEnX(eje, 36, 144)).toBe(720);   // 36·10 + 360 = 12:00
    });
});
