/**
 * ⚠️ ¿EL COLOR DE UNA PERSONA CAMBIA SEGÚN EL PUESTO? PORQUE ESO SERÍA LA LEY 2 ROTA.
 *
 * Sara Gil, forzada en Barra, se ve rosa/morado claro. Su barra habitual en Cocina «parece otra».
 * Y hay una explicación inocente —la muesca del forzado, el anillo de gravedad, el ancho— y una
 * catastrófica: que el color se asigne por algo que no sea LA PERSONA.
 *
 *     EL RELLENO DICE DE QUIÉN ES. Y de nadie más. Ni del puesto, ni del día, ni de su estado.
 *
 * Esto mide el relleno REAL de cada barra —sobre la imagen, no en el CSS— y comprueba que todas las
 * barras de una misma persona son el mismo color, esté donde esté.
 *
 * ⚠️ Y NO SE COMPARA CONTRA EL CSS DECLARADO: se compara BARRA CONTRA BARRA. Si el color se
 * asignara mal en el servidor, el CSS y el píxel coincidirían —los dos mentirían igual— y la
 * comprobación pasaría. Lo que no puede pasar es que DOS barras de la misma persona discrepen.
 *
 *   node tests/Visual/identidad.mjs
 */
import { chromium } from 'playwright';
import { deltaE00, entrar, lunesDe, INDISTINGUIBLE } from './pixel.mjs';

const BASE = 'http://turnia.test';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 2400 } });

await entrar(page, BASE);
await page.goto(`${BASE}/companies/1/calendars/1/schedule?week=${lunesDe(0)}`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-t=tramo]', { timeout: 90000 });
await page.waitForTimeout(1500);

const buf = await page.screenshot({ fullPage: false });

const medido = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();

    const c = new OffscreenCanvas(img.width, img.height);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const escala = img.width / window.innerWidth;

    const barras = [];

    for (const b of document.querySelectorAll('[data-t=barra][data-assignment-id]')) {
        const r = b.getBoundingClientRect();

        // Fuera de la ventana: el píxel no existe en la captura. No se inventa, se salta.
        if (r.top < 0 || r.bottom > window.innerHeight || r.width < 3) {
            continue;
        }

        const carril = b.closest('[data-t=carril]');
        const celda = b.closest('[data-celda]');

        /*
         * ⚠️ LA MEDIA DEL RELLENO, NO UN PUNTO. La barra imposible lleva TRAMA (rayas de 2 px cada
         * 8): un punto suelto puede caer justo en una raya y devolver la sombra en vez del color.
         * Es la mentira #18, y ya la pagué una vez.
         */
        const x0 = Math.round((r.left + 2) * escala);
        const x1 = Math.round((r.right - 2) * escala);
        const y0 = Math.round((r.top + 3) * escala);
        const y1 = Math.round((r.bottom - 3) * escala);

        let sr = 0, sg = 0, sb = 0, n = 0;

        for (let x = x0; x < x1; x += 1) {
            for (let y = y0; y < y1; y += 1) {
                const p = ctx.getImageData(x, y, 1, 1).data;
                sr += p[0]; sg += p[1]; sb += p[2]; n += 1;
            }
        }

        if (! n) {
            continue;
        }

        barras.push({
            persona: carril?.dataset.persona ?? '?',
            celda: celda?.dataset.celda ?? '?',
            ancho: +r.width.toFixed(1),
            declarado: getComputedStyle(b).backgroundColor,
            pixel: [Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)],
        });
    }

    return barras;
}, buf.toString('base64'));

await browser.close();

const di = console.log;
const fallos = [];

di('\n¿EL COLOR DE UNA PERSONA ES EL MISMO EN TODOS LOS PUESTOS?');
di('═'.repeat(104));
di('(media del relleno, medida SOBRE LA IMAGEN. Barra contra barra: si dos discrepan, es la ley 2.)\n');

const porPersona = new Map();

for (const b of medido) {
    if (! porPersona.has(b.persona)) {
        porPersona.set(b.persona, []);
    }

    porPersona.get(b.persona).push(b);
}

// ⚠️ CERO CASOS NO ES CERO FALLOS. Si no hay nada que medir, se grita.
if (porPersona.size < 2) {
    di('❌ NO HAY NADA QUE MEDIR: menos de dos personas con barras visibles.');
    di('   Un instrumento sin casos no está en verde: está CIEGO.\n');
    process.exit(1);
}

let pares = 0;

for (const [persona, barras] of [...porPersona].sort()) {
    if (barras.length < 2) {
        di(`  ·  ${persona.padEnd(14)} una sola barra visible: nada que comparar`);
        continue;
    }

    // El par MÁS LEJANO de esa persona. Si el peor caso aguanta, aguantan todos.
    // ⚠️ -1, y no 0: si TODAS las barras son idénticas (ΔE 0), con 0 nunca se elegiría un par y
    // el instrumento reventaría al imprimirlo. El caso perfecto no puede romper al que lo mide.
    let peor = { d: -1 };

    for (let i = 0; i < barras.length; i++) {
        for (let j = i + 1; j < barras.length; j++) {
            const d = deltaE00(barras[i].pixel, barras[j].pixel);
            pares += 1;

            if (d > peor.d) {
                peor = { d, a: barras[i], b: barras[j] };
            }
        }
    }

    const mal = peor.d >= INDISTINGUIBLE;

    if (mal) {
        fallos.push(`${persona}: ΔE ${peor.d.toFixed(1)} entre «${peor.a.celda}» y «${peor.b.celda}»`);
    }

    di(`  ${mal ? '❌' : '✅'} ${persona.padEnd(14)} ${String(barras.length).padStart(2)} barras · el par más lejano: ΔE ${peor.d.toFixed(1).padStart(5)}`
        + `   (${peor.a.celda} vs ${peor.b.celda})`);

    // El detalle: qué se ve en cada una. Un estadístico solo no enseña nada.
    for (const b of barras) {
        di(`        ${b.celda.padEnd(22)} ${String(b.ancho).padStart(5)} px   se ve rgb(${b.pixel.join(',')})   declara ${b.declarado}`);
    }
}

di('\n' + '═'.repeat(104));
di(`  ${pares} pares comparados · umbral: ΔE ${INDISTINGUIBLE} (por encima, el ojo los ve DISTINTOS)\n`);

if (! fallos.length) {
    di('✅ Cada persona se ve del MISMO color en todos sus puestos. El relleno dice de quién es,');
    di('   y no de qué puesto es. (Lo que cambia entre barras es el anillo, la trama y la muesca —');
    di('   canales distintos, ley 0 — pero el RELLENO no se mueve.)\n');
    process.exit(0);
}

di('❌ LA LEY 2 ESTÁ ROTA: el color de una persona CAMBIA según dónde esté.\n');
fallos.forEach((f) => di(`   · ${f}`));
di();
process.exitCode = 1;
