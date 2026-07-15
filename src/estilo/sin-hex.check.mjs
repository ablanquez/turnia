/*
 * NINGÚN COLOR SUELTO — la gobernanza que a ZGZ le faltaba (allí era solo una regla escrita).
 *
 * Todo color pasa por su fuente única. Un #hex o un rgb()/hsl()/oklch() en un .vue o un .css que no
 * sea tokens.css es un color que se coló sin pasar por la ley (sin medir su ΔE, sin salir en el
 * tablero). Este checker lo caza.
 *
 *   node src/estilo/sin-hex.check.mjs
 *
 * Permitido: tokens.css (la fuente fija), paleta.js (identidad, es .js y no se escanea) y el logo
 * (.svg, literal heredado). Los comentarios que citan un hex a modo de nota no cuentan.
 */
import { readdirSync, readFileSync } from 'fs';
import { join, relative, basename } from 'path';

const PERMITIDOS = new Set(['tokens.css']);
const ESCANEA = /\.(vue|css)$/;
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FUNC = /\b(rgba?|hsla?|oklch|oklab|lch|lab)\s*\(/;

function* archivos(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) yield* archivos(p);
        else if (ESCANEA.test(e.name)) yield p;
    }
}

// ¿el color aparece dentro de un comentario? (nota, no estilo aplicado)
function enComentario(linea, indice) {
    const antes = linea.slice(0, indice);
    return /(\/\/|\/\*|^\s*\*|<!--)/.test(antes) || /^\s*(\*|\/\/|<!--)/.test(linea);
}

const malos = [];
for (const f of archivos('src')) {
    if (PERMITIDOS.has(basename(f))) continue;
    readFileSync(f, 'utf8').split(/\r?\n/).forEach((linea, i) => {
        const mHex = linea.match(HEX);
        const mFun = linea.match(FUNC);
        const m = mHex ?? mFun;
        if (m && ! enComentario(linea, m.index)) {
            malos.push({ f: relative('.', f).replace(/\\/g, '/'), n: i + 1, txt: linea.trim() });
        }
    });
}

const di = console.log;
if (! malos.length) {
    di('✅ Ningún color suelto: todo pasa por tokens.css / paleta.js / el logo.');
    process.exit(0);
}

di(`❌ ${malos.length} COLOR(ES) SUELTO(S) fuera de la fuente:`);
for (const m of malos) {
    di(`   · ${m.f}:${m.n}  ${m.txt}`);
}
di('\n   Muévelo a tokens.css (o a paleta.js si es identidad) y consúmelo por token. No hay #hex en un .vue.');
process.exit(1);
