import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import { bunny } from 'laravel-vite-plugin/fonts';
import inertia from '@inertiajs/vite';
import tailwindcss from '@tailwindcss/vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.js'],
            refresh: true,

            // Las fuentes se DESCARGAN y se sirven desde nuestro dominio. Ninguna
            // petición a un CDN: la app va detrás de login y maneja datos sanitarios,
            // así que no debe filtrar a terceros ni siquiera quién la abre. Como
            // efecto secundario, el despliegue no depende de nadie.
            fonts: [
                bunny('IBM Plex Sans', { weights: [400, 500, 600, 700] }),

                // Mono para las HORAS: números tabulares, para que las cifras no
                // bailen de una fila a otra. En una parrilla se leen en columna.
                bunny('IBM Plex Mono', { weights: [400, 500, 600, 700] }),
            ],
        }),

        // El orden es el del starter kit oficial de Laravel: inertia antes que vue.
        inertia(),
        tailwindcss(),
        vue({
            template: {
                transformAssetUrls: {
                    base: null,
                    includeAbsolute: false,
                },
            },
        }),
    ],
    server: {
        watch: {
            ignored: ['**/storage/framework/views/**'],
        },
    },
});
