import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Se sirve en la raíz del subdominio (turnia.antonioblanquez.es), así que base '/'.
export default defineConfig({
    plugins: [vue(), tailwindcss()],
});
