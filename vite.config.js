// Import desde 'vitest/config' (no 'vite'): reexporta el defineConfig de Vite AÑADIENDO el tipo de la
// sección `test`. Así una sola config sirve para build y para test, reaprovecha los plugins, y no hay
// un segundo fichero de config que derive. Es la forma que recomienda la doc oficial de Vitest para un
// proyecto que ya tiene vite.config.
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Se sirve en la raíz del subdominio (turnia.antonioblanquez.es), así que base '/'.
//
// ⚠️ Los plugins se EXCLUYEN bajo Vitest (process.env.VITEST). Los tests de aquí son funciones puras
// (.js) que no necesitan ni transformar .vue ni generar CSS; y el plugin de Tailwind v4 revienta en el
// pipeline de test en entorno node ("Cannot read properties of undefined (reading 'config')"). No es
// una ñapa: es que build y test son pipelines distintos y el de test no necesita esos plugins.
export default defineConfig({
    plugins: process.env.VITEST ? [] : [vue(), tailwindcss()],

    // ── TESTS ────────────────────────────────────────────────────────────────────────────────
    // Entorno `node`: la lógica que se prueba aquí (useEje, normaliza) son FUNCIONES PURAS. jsdom
    // sería peor que nada: no calcula layout, getBoundingClientRect daría ceros, y un test verde
    // contra ese sustituto no probaría nada. La GEOMETRÍA (píxel resultante) se mide con navegador
    // de verdad en tools/geometria.check.mjs (punto 5), NO aquí.
    //
    // CONVENCIÓN DE UBICACIÓN (una, y escrita para que nadie invente una segunda): el test vive
    // JUNTO al fichero que prueba — `useEje.test.js` al lado de `useEje.js`. Sin carpeta tests/.
    test: {
        environment: 'node',
        // ⚠️ CARGA ESTRUCTURAL — el hook commit-msg CUENTA con este glob. Si se rompe, o alguien mueve
        // los tests fuera de él, `vitest run` no encuentra NINGUNO y sale con código 1; el hook lo trata
        // como fallo y BLOQUEA el commit. Es a propósito: «0 casos» NO es «0 fallos» — es uno de los
        // falsos verdes clásicos del proyecto (como el .gitignore que escondió la auditoría). No lo
        // "arregles" para que pase en vacío: ese exit 1 es la guardia, no el bug.
        include: ['src/**/*.test.js'],
    },
});
