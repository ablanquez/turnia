import { describe, test, expect } from 'vitest';
import { retimarTurno } from './retimarTurno.js';
import { editarTurno, acotaInicio, horaAAbsoluto } from './editarTurno.js';
import { normaliza, minutos } from './useEje.js';

/*
 * LA RED QUE FALTABA (Bloque 4 · 2.d · PC2.b). El fallo que Antonio cazó ARRASTRANDO —cruzar la
 * medianoche y ver el turno RETROCEDER un día— no lo veía ningún instrumento: los tres medían
 * INTEGRIDAD (¿el turno está entero? ¿los trozos suman?), NINGUNO medía IDENTIDAD (¿está en el día
 * que es?). Un turno completo en el día equivocado pasa cualquier comprobación de integridad.
 *
 * La propiedad que sujeta el fallo, enunciada como testigo independiente:
 *   «una operación que desplaza el tiempo Δ desplaza el ARRANQUE ABSOLUTO exactamente Δ, calendario
 *    incluido» — es decir, `dia` acompaña a `inicio` cuando el reloj cruza medianoche.
 *
 * El arranque absoluto = fecha del día (en minutos, testigo independiente vía Date.UTC) + reloj de
 * inicio. NO replica la fórmula del código (sumarDias/anclarInicio): la calcula por otro camino, para
 * que un error compartido no se esconda.
 *
 * Cubre los TRES caminos que empujan el inicio (§3.b): arrastre (retimarTurno), y las dos entradas del
 * editor —tirador y teclado— que desembocan en editarTurno. Los tres estaban rotos igual; los tres
 * quedan sujetos aquí. Cada aserción nació viendo su rojo (el rojo, al lado).
 */

// Arranque absoluto en minutos, por un camino independiente del código de producción.
function absInicio(t) {
    const [y, m, d] = t.dia.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 60000 + minutos(t.inicio);
}

// Iker partido: Jue 22:00 → 07:00 (9 h). El caso exacto de Antonio.
const IKER = Object.freeze([Object.freeze({ id: 'k', persona: 'iker', puesto: 'cocina', dia: '2026-07-16', inicio: '22:00', fin: '07:00' })]);

describe('la propiedad del instante: el día acompaña al reloj (ARRASTRE)', () => {
    test('cruzar medianoche ADELANTE desplaza el arranque absoluto +Δ y RUEDA el día a Vie', () => {
        const t0 = normaliza(IKER[0]);           // iniMin 1320 (22:00)
        const delta = 180;                        // +3 h → 01:00, cruza a Vie
        const abs0 = absInicio(IKER[0]);
        const r = retimarTurno(IKER, 'k', t0.iniMin + delta); // nuevo inicio 1500 (fuera de [0,1440))
        const t1 = r.find((x) => x.id === 'k');
        // ⚠️ ROJO sin acarreo: el día queda en Jue, así que el arranque absoluto RETROCEDE 1440−180 = 1260 min.
        expect(absInicio(t1) - abs0).toBe(delta);
        expect(t1.dia).toBe('2026-07-17');        // Vie 17, no Jue 16
        expect(t1.inicio).toBe('01:00');
        expect(t1.fin).toBe('10:00');             // 01:00 + 9 h, reloj (normaliza no lo necesita: no cruza)
    });

    test('cruzar medianoche ATRÁS (simétrico) desplaza −Δ y RETROCEDE el día a Mié', () => {
        const base = Object.freeze([Object.freeze({ id: 'k', persona: 'iker', puesto: 'cocina', dia: '2026-07-16', inicio: '01:00', fin: '05:00' })]);
        const t0 = normaliza(base[0]);            // iniMin 60 (01:00)
        const delta = -120;                        // −2 h → 23:00 del día anterior
        const abs0 = absInicio(base[0]);
        const r = retimarTurno(base, 'k', t0.iniMin + delta); // nuevo inicio −60 (fuera de [0,1440))
        const t1 = r.find((x) => x.id === 'k');
        expect(absInicio(t1) - abs0).toBe(delta);
        expect(t1.dia).toBe('2026-07-15');        // Mié 15
        expect(t1.inicio).toBe('23:00');
    });

    test('un retimado que NO cruza medianoche deja el día quieto', () => {
        const r = retimarTurno(IKER, 'k', 1380);  // 23:00, mismo día
        const t1 = r.find((x) => x.id === 'k');
        expect(t1.dia).toBe('2026-07-16');
        expect(t1.inicio).toBe('23:00');
    });
});

describe('la propiedad del instante cubre las DOS entradas del editor (§3.b)', () => {
    // El acarreo del día vive en la ESCRITURA (editarTurno). Basta comprobar que cada entrada ENTREGA un
    // iniMin pasado de medianoche (≥1440 en el marco absoluto del editor) y que editar lo ancla al día real.
    const ejeIker = { desde: 360, hasta: 1860 }; // el eje del editor de Iker tras el fix del eje (2.d · PC2.b)

    test('EDITOR · Aplicar: editar con inicio pasado de medianoche rueda el día y conserva el arranque absoluto', () => {
        const abs0 = absInicio(IKER[0]);
        const r = editarTurno(IKER, 'k', { iniMin: 1500, finMin: 1500 + 540, dia: '2026-07-16', puesto: 'cocina' });
        const t1 = r.find((x) => x.id === 'k');
        expect(t1.dia).toBe('2026-07-17');        // ⚠️ ROJO sin acarreo: se queda en Jue
        expect(t1.inicio).toBe('01:00');
        expect(absInicio(t1) - abs0).toBe(1500 - 1320); // +180
    });

    test('TIRADOR: acotaInicio entrega un inicio ≥1440 y editar lo rueda al día correcto', () => {
        const { iniMin } = acotaInicio(1500, { finMin: 1860, eje: ejeIker }); // el tirador pide 01:00 (marco absoluto)
        expect(iniMin).toBe(1500);                // fuera del día base
        const r = editarTurno(IKER, 'k', { iniMin, finMin: iniMin + 360, dia: '2026-07-16', puesto: 'cocina' });
        expect(r.find((x) => x.id === 'k').dia).toBe('2026-07-17');
    });

    test('TECLADO: horaAAbsoluto levanta 01:00 a 1500 y editar lo rueda al día correcto', () => {
        const abs = horaAAbsoluto(60, 'inicio', { iniMin: 1320, eje: ejeIker }); // teclea 01:00
        expect(abs).toBe(1500);                   // 60 < 360 → +1440
        const r = editarTurno(IKER, 'k', { iniMin: abs, finMin: abs + 360, dia: '2026-07-16', puesto: 'cocina' });
        expect(r.find((x) => x.id === 'k').dia).toBe('2026-07-17');
    });
});
