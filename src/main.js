import { createApp } from 'vue';

// IBM Plex Sans (texto) e IBM Plex Mono (horas, tabulares) — servidas desde el propio bundle
// (@fontsource), sin llamadas a ningún CDN. Solo el subset LATIN: cubre el español (ñ, acentos,
// ¿¡) y evita arrastrar cirílico/griego/vietnamita que no usamos.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';

import './estilo/estilo.css';
import App from './App.vue';
import router from './router.js';

createApp(App).use(router).mount('#app');
