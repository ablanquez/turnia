/**
 * LA RAMPA: ¿A PARTIR DE QUÉ ANCHO DE BARRA EL ANILLO SE COME EL RELLENO?
 *
 * ⚠️ ESTE FICHERO EXISTE PORQUE EL PEOR CASO GEOMÉTRICO DE LA APP NO ESTABA SEMBRADO EN NINGÚN
 * SITIO, Y POR TANTO NINGÚN INSTRUMENTO LO HABÍA MEDIDO NUNCA.
 *
 * El anillo de gravedad rodea la barra por los CUATRO lados, así que su peso es
 *
 *     1 − (ancho × alto) / ((ancho + 2w) × (alto + 2w))
 *
 * En un turno de OCHO horas la barra mide ~50 px y el anillo del imposible (4 px) pesa el 43 %.
 * En un turno de UNA hora la barra mide 6 px, y ese mismo anillo pasa a pesar el SETENTA POR
 * CIENTO. La barra deja de ser "una persona con una alarma alrededor" y se vuelve una MANCHA.
 *
 * Y toda la demo, y todos los 96 casos del cuadrante de la matriz, usan turnos de 8 horas.
 *
 * Se destapó pensando en el responsive —estrechar una columna hace exactamente lo mismo que
 * acortar un turno— y al medirlo salió el bug de Marco reencarnado: un turno de una hora de
 * #742C8A (púrpura oscuro) con un aviso ámbar se ve #A76E58, MARRÓN, a ΔE 15,2 de la tinta de
 * incumplimiento.
 *
 * ⚠️ Y EL UMBRAL NO SE CALCULA: SE MIDE. El modelo analítico dice que #742C8A no aguanta ni a
 * 40 px, y la imagen dice que a 8 h aguanta de sobra — porque el modelo no sabe de esquinas
 * redondeadas ni de antialiasing. Así que se siembra la rampa entera (1, 2, 3, 4, 6 y 8 horas ×
 * las tres gravedades) y se lee el número DE LA IMAGEN.
 *
 *   php artisan db:seed --class=MatrizSeeder
 *   node tests/Visual/anchos.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import {
    FAMILIA_DE_ANILLO, SUENA,
    conRelleno, deltaE00, entrar, hex, localizar, muestrear, rgbDe, sueneA,
} from './pixel.mjs';

const BASE = 'http://turnia.test';
const M = JSON.parse(readFileSync(new URL('./matriz.json', import.meta.url), 'utf8'));

const browser = await chromium.launch();

// ⚠️ 1280 px de ancho, que es EL MÍNIMO SOPORTADO: ahí la columna está en su mínimo (150 px) y las
// barras son lo más estrechas que pueden llegar a ser. Medir el peor caso en la resolución más
// cómoda sería medir el peor caso donde menos duele.
const page = await browser.newPage({ viewport: { width: 1280, height: 3000 } });

await entrar(page, BASE);
await page.evaluate(() => localStorage.setItem('turnia.panel-plantilla', 'recogido'));

await page.goto(`${BASE}${M.anchos.url}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('[data-t=indicador]', { timeout: 90000 });
await page.waitForTimeout(1200);

const png = await page.screenshot();

mkdirSync(new URL('./salida/', import.meta.url), { recursive: true });
writeFileSync(new URL('./salida/anchos.png', import.meta.url), png);

const piezas = await page.evaluate(localizar);
const muestras = await muestrear(page, png, piezas.filter((p) => p.tipo === 'barra' && !p.sinRelleno && !p.tapada && p.persona !== '?'));

await browser.close();

/* ══════════════════════════════════════════════════════════════════════════════ */

let salida = '';
const di = (s = '') => { salida += s + String.fromCharCode(10); console.log(s); };
const pad = (s, n) => String(s).padEnd(n).slice(0, n);

const fallos = [];

di();
di('LA RAMPA — el ancho de la barra contra la ley 0, medido sobre la imagen a 1280 px (el mínimo)');
di('═'.repeat(112));
di();
di(`${pad('PERSONA', 16)} ${pad('GRAVEDAD', 11)} ${pad('BARRA', 10)} ${pad('EL ANILLO PESA', 15)} ${pad('SE VE', 9)} ${pad('GRAVEDAD AJENA MÁS CERCANA', 28)} ΔE00`);
di('─'.repeat(112));

const conAnillo = muestras
    .filter((p) => p.integrada && p.anillo > 0 && conRelleno(p))
    .sort((a, b) => a.ancho - b.ancho);

if (!conAnillo.length) {
    fallos.push('NO HA SALIDO NI UNA BARRA CON ANILLO. Esta rampa no ha probado nada, y callarlo sería aprobar por omisión.');
}

let elUltimoQueFalla = 0;
let elPrimeroQueAguanta = Infinity;

for (const p of conAnillo) {
    const mia = FAMILIA_DE_ANILLO[p.anilloDeclarado] ?? '?';
    const otra = sueneA(p.integrada, mia);
    const w = p.anillo;

    /*
     * EL PESO DEL ANILLO EN LA CAJA QUE SE INTEGRA.
     *
     * ⚠️ Y ES ESTA FÓRMULA, Y NO LA OTRA, LO QUE ARREGLÓ EL BUG. Cuando el anillo RODEABA los
     * cuatro lados, el peso era 1 − (ancho×alto)/((ancho+2w)(alto+2w)) y DEPENDÍA DEL ANCHO: 35 %
     * en un turno de 8 h y 67 % en uno de 1 h. Ahora son dos franjas, arriba y abajo, y el peso es
     * 2w/(alto+2w): el MISMO a cualquier ancho.
     */
    const peso = (2 * w) / (p.alto + 2 * w);

    const ok = otra.d >= SUENA;

    if (ok) {
        elPrimeroQueAguanta = Math.min(elPrimeroQueAguanta, p.ancho);
    } else {
        elUltimoQueFalla = Math.max(elUltimoQueFalla, p.ancho);

        fallos.push(
            `la barra de «${p.persona}» (${mia}, ${Math.round(p.ancho)}px de ancho) se ve ${hex(p.integrada)} y queda a `
            + `ΔE ${otra.d.toFixed(1)} de «${otra.nombre}» — una gravedad que NO ES LA SUYA.`,
        );
    }

    di(
        `${pad(p.persona, 16)} ${pad(mia, 11)} ${pad(`${Math.round(p.ancho)}×${Math.round(p.alto)}`, 10)} `
        + `${pad(`${(peso * 100).toFixed(0)} %`, 15)} ${pad(hex(p.integrada), 9)} ${pad(otra.nombre, 28)} `
        + `${ok ? '✅' : '❌'} ${otra.d.toFixed(1)}`,
    );
}

di('─'.repeat(112));
di();
di(`${conAnillo.length} barras con anillo medidas · umbral: ninguna a menos de ΔE ${SUENA} de una gravedad ajena`);

if (elUltimoQueFalla) {
    di();
    di(`⚠️  LA BARRA MÁS ANCHA QUE FALLA MIDE ${Math.round(elUltimoQueFalla)} px.`);
    di(`   La más estrecha que aguanta mide ${elPrimeroQueAguanta === Infinity ? '—' : Math.round(elPrimeroQueAguanta)} px.`);
    di('   El umbral está entre esos dos números, y ahí es donde el relleno deja de caber.');
}

di();

if (fallos.length) {
    di(`❌ ${fallos.length} FALLOS:`);
    di();
    fallos.forEach((f) => di(`   · ${f}`));
} else {
    di('✅ En toda la rampa —de 1 a 8 horas— ninguna barra suena a una gravedad que no es la suya.');
}

di();

writeFileSync(new URL('./salida/anchos.txt', import.meta.url), salida);

process.exit(fallos.length ? 1 : 0);
