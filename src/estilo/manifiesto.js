/*
 * EL ÍNDICE DE TOKENS — qué hay y a qué familia pertenece. SIN valores.
 *
 * Los valores viven en tokens.css (fuente única) y se LEEN de ahí: el tablero por getComputedStyle,
 * el checker parseando el fichero. Aquí solo están los nombres y las etiquetas, para que añadir un
 * color sea: meterlo en tokens.css + una línea aquí, y aparece solo en el tablero y en el checker.
 *
 * `clase` decide el umbral de exclusión frente a la identidad:
 *   'estado' → ΔE 24  (afirma algo del cuadrante)
 *   'fondo'  → ΔE 8   (marca y composición: no afirman nada)
 */
export const FAMILIAS = [
    {
        familia: 'semantica',
        etiqueta: 'Semántica',
        clase: 'estado',
        descripcion: 'Gravedades y cobertura. El relleno manda el vistazo; la tinta, la lectura.',
        grupos: [
            {
                titulo: 'Gravedades',
                items: [
                    { var: '--color-impossible-fill', label: 'Imposible · relleno' },
                    { var: '--color-impossible-text', label: 'Imposible · tinta' },
                    { var: '--color-breach-fill', label: 'Incumplimiento · relleno' },
                    { var: '--color-breach-text', label: 'Incumplimiento · tinta' },
                    { var: '--color-notice-fill', label: 'Aviso · relleno' },
                    { var: '--color-notice-text', label: 'Aviso · tinta' },
                    { var: '--color-ok-fill', label: 'Correcto · relleno' },
                    { var: '--color-ok-text', label: 'Correcto · tinta' },
                ],
            },
            {
                titulo: 'Cobertura (la tira)',
                items: [
                    { var: '--color-covered-fill', label: 'Correcto · relleno' },
                    { var: '--color-covered-edge', label: 'Correcto · borde' },
                    { var: '--color-missing-fill', label: 'Falta · relleno' },
                    { var: '--color-missing-edge', label: 'Falta · borde' },
                    { var: '--color-excess-fill', label: 'Exceso · relleno' },
                    { var: '--color-excess-edge', label: 'Exceso · borde' },
                    { var: '--color-void-fill', label: 'Sin candidato · relleno' },
                ],
            },
        ],
    },
    {
        familia: 'marca',
        etiqueta: 'Marca',
        clase: 'fondo',
        descripcion: 'El índigo de la marca. Nunca lleva estado.',
        grupos: [
            {
                titulo: 'Índigo',
                items: [
                    { var: '--color-brand-50', label: 'brand-50' },
                    { var: '--color-brand-300', label: 'brand-300' },
                    { var: '--color-brand-600', label: 'brand-600' },
                    { var: '--color-brand-800', label: 'brand-800' },
                ],
            },
        ],
    },
    {
        familia: 'composicion',
        etiqueta: 'Composición',
        clase: 'fondo',
        descripcion: 'La página: superficies, líneas de estructura y tinta. Silenciosa; solo ordena.',
        grupos: [
            {
                titulo: 'Superficies',
                items: [
                    { var: '--color-page', label: 'page' },
                    { var: '--color-panel', label: 'panel' },
                    { var: '--color-card', label: 'card' },
                    { var: '--color-rail', label: 'rail' },
                    { var: '--color-band', label: 'band' },
                    { var: '--color-sunken', label: 'sunken' },
                ],
            },
            {
                titulo: 'Líneas (sección > día > pelo)',
                items: [
                    { var: '--color-edge', label: 'edge · sección' },
                    { var: '--color-line', label: 'line · día' },
                    { var: '--color-line-soft', label: 'line-soft · pelo' },
                ],
            },
            {
                titulo: 'Tinta',
                items: [
                    { var: '--color-ink', label: 'ink' },
                    { var: '--color-ink-soft', label: 'ink-soft' },
                    { var: '--color-ink-faint', label: 'ink-faint' },
                ],
            },
        ],
    },
];

/** Todos los tokens en una lista plana, con su clase de exclusión. */
export function todosLosTokens() {
    return FAMILIAS.flatMap((f) => f.grupos.flatMap((g) => g.items.map((it) => ({ ...it, familia: f.familia, clase: f.clase }))));
}
