import { createApp } from 'vue';

// IBM Plex Sans (texto) e IBM Plex Mono (horas, tabulares) — servidas desde el propio bundle
// (@fontsource), sin llamadas a ningún CDN.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';

import './estilo/estilo.css';
import App from './App.vue';
import router from './router.js';

createApp(App).use(router).mount('#app');
