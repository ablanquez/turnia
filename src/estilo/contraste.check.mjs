/*
 * ¿CUMPLE EL COLOR LA LEY? — el verificador de Node (para el hook y para cerrar tanda).
 *
 * Lee los colores de LA FUENTE, no de una copia: la identidad de paleta.js, y los tokens fijos
 * PARSEANDO tokens.css. Si mañana alguien mueve un color en tokens.css, este checker lo ve.
 *
 *   node src/estilo/contraste.check.mjs
 *
 * Sale 1 (y lo canta) si alguna persona baja de su umbral (ΔE 24 estados / 8 fondos), si un croma
 * cae por debajo de 30, o si R < D/2 se rompe. Verde = ninguna colisión.
 */
import { readFileSync } from 'fs';
import { IDENTIDAD } from '../datos/paleta.js';
import { todosLosTokens } from './manifiesto.js';
import { auditar, UMBRAL_ESTADO, UMBRAL_MARCA } from './reglas.js';

const di = console.log;

// ── Los tokens fijos, leídos de tokens.css (la fuente) ───────────────────────
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const valor = {};
for (const m of css.matchAll(/(--color-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    valor[m[1]] = m[2];
}

const tokens = todosLosTokens();
const faltan = tokens.filter((t) => ! valor[t.var]);

// ⚠️ Cero casos no es cero fallos: si un token del manifiesto no está en tokens.css, se grita.
if (faltan.length) {
    di('❌ TOKENS DEL MANIFIESTO QUE NO ESTÁN EN tokens.css:');
    faltan.forEach((t) => di(`   · ${t.var}`));
    di('   El manifiesto y la fuente se han separado. Corrige antes de medir.\n');
    process.exit(1);
}

const identidad = IDENTIDAD.map((hex, i) => ({ nombre: `persona ${String(i + 1).padStart(2, '0')}`, hex }));
const estados = tokens.filter((t) => t.clase === 'estado').map((t) => ({ nombre: t.label, hex: valor[t.var] }));
const fondos = tokens.filter((t) => t.clase === 'fondo').map((t) => ({ nombre: t.label, hex: valor[t.var] }));

const r = auditar({ identidad, estados, fondos });

di('\nLA LEY DEL COLOR — cada persona contra estados (ΔE 24) y fondos/marca (ΔE 8)');
di('═'.repeat(96));
di(`  D (ΔE mín entre personas) = ${r.D.toFixed(1)}   ·   D/2 = ${(r.D / 2).toFixed(1)}   ·   R = ${r.R}   ·   R < D/2 ${r.cumpleRD ? '✅' : '❌'}`);
di(`  (R = 0: barras de relleno plano; la trama/anillo/alfa aún no existen — se re-medirá al llegar)\n`);

for (const f of r.filas) {
    const okE = f.aEstado.d >= UMBRAL_ESTADO;
    const okF = f.aFondo.d >= UMBRAL_MARCA;
    di(`  ${okE && okF && f.croma >= 30 ? '✅' : '❌'} ${f.persona}  ${f.hex}`
        + `   estado≥24: ${f.aEstado.d.toFixed(1).padStart(5)} (${f.aEstado.nombre})`
        + `   fondo≥8: ${f.aFondo.d.toFixed(1).padStart(5)} (${f.aFondo.nombre})`
        + `   croma: ${f.croma.toFixed(0)}`);
}

di('\n' + '═'.repeat(96));

if (r.ok) {
    di('✅ Ningún color de persona suena a un estado, ni es un fondo ni la marca. R < D/2.\n');
    process.exit(0);
}

di(`❌ ${r.choques.length} CHOQUE(S):`);
for (const c of r.choques) {
    di(`   · «${c.persona}» a ΔE ${c.d.toFixed(1)} de «${c.contra}» (umbral ${c.umbral})`);
}
di('\n   Un color que significa algo no puede vivir en la zona de las personas.\n');
process.exit(1);
