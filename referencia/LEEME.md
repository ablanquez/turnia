# referencia/ — SOLO LECTURA · arqueología del Turnia viejo

Esto es el Turnia v1 (Laravel) para **ENTENDER las decisiones**, no para copiar código.

⚠️ **Regla del proyecto (CLAUDE.md · "Se heredan las decisiones, no el código"):** nada de aquí se
importa ni se clona. Se lee para entender qué se decidió y por qué, y el código nuevo se **reescribe
limpio** con ese conocimiento. La única herencia literal son los valores que ya son fuente de verdad
(colores, hex, el SVG del logo), y esos viven en `src/estilo`, no aquí.

## Qué hay
- **`docs/`** — el aprendizaje del viejo: `MATRIZ-VISUAL.md` (las leyes del color y la parrilla),
  `ESCRIBIR.md`, `ESTRES-MOTOR.md`, `COTEJO-VISUAL.md`, `AUDITORIA-VISUAL.md`,
  `BACKTEST-COMBINATORIO.md`, `PENDIENTES.md`, `RESPONSIVE.md`, y `design/parrilla-referencia.html`
  (un render del viejo, útil para cotejar píxel).
- **`TURNIA-ESTADO.md`** — la bitácora/estado del viejo.
- **`visual/`** — ficheros clave del viejo para entender el diseño y cotejar: `WeekGrid.vue`,
  `PersonLane.vue`, `DayGrid.vue`, `app.css`, `useSeverity.js`, `useArrastre.js`, `useAxis.js`,
  `useMatrizVisual.js`, `PersonPalette.php`.

## El original completo
Todo el v1 está archivado y recuperable en git:

```
git checkout archivo/v1-laravel        # el tag inmutable
# o la rama:  archivo/laravel-inertia
```
