import { createInertiaApp } from '@inertiajs/vue3';

// El plugin de Vite resuelve las páginas de resources/js/Pages: no hace falta
// un resolver a mano.
createInertiaApp({
    progress: {
        color: '#7F77DD',
    },
});
