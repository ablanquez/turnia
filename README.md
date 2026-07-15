# TURNIA

Gestor de cuadrantes de turnos. **Prototipo** Vue 3 + Vite + Tailwind 4 (sin backend, datos a fuego).

> ⚠️ Este repositorio se **reinició** el 15-jul-2026. La versión previa (Laravel + Inertia + MySQL)
> creció con las capas en mal orden y se archivó para empezar por los cimientos: lo mínimo
> funcionando perfecto (la parrilla se ve y las barras se arrastran), y las capas encima con base
> firme.
>
> **Para navegar la v1 archivada:** `git checkout archivo/v1-laravel` (o la rama `archivo/laravel-inertia`).

## Desarrollo

```bash
npm install
npm run dev       # servidor de desarrollo (HMR)
npm run build     # compila a dist/
```

## Despliegue

`turnia.antonioblanquez.es` (Hostinger). Claude Code compila en local y empuja lo compilado a la
rama `produccion`; el host hace `git pull` de esa rama por cron. `main` es solo fuente. Ver
`deploy.sh` y `docs/PLAN-ARRANQUE.md`.

## Método

Las reglas permanentes viven en `CLAUDE.md` (se leen cada sesión). Los fallos se graban en caliente
en `docs/BITACORA.md` (obligatorio por hook en cada `fix:`). El sistema de diseño y sus cuatro
familias de color en `docs/ESTILO.md` y `src/estilo/`.
