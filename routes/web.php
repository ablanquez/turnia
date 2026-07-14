<?php

use App\Http\Controllers\AssignmentController;
use App\Http\Controllers\AssignmentPreviewController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\SuggestedShiftController;
use Illuminate\Support\Facades\Route;

/*
 * TODO VA DETRÁS DE LOGIN. No hay parte pública, ni siquiera de solo lectura.
 *
 * Turnia guarda bajas médicas y permisos por enfermedad. Un cuadrante "público
 * pero con una URL difícil de adivinar" seguiría siendo público.
 */
Route::middleware('auth')->group(function () {
    Route::get('/', fn () => redirect()->route('dashboard'))->name('home');

    Route::get('/dashboard', DashboardController::class)->name('dashboard');

    Route::get('/companies/{company}/calendars/{calendar}/schedule', [ScheduleController::class, 'week'])
        ->name('schedule.week');

    Route::get('/companies/{company}/calendars/{calendar}/schedule/day', [ScheduleController::class, 'day'])
        ->name('schedule.day');

    /*
     * ═══════════════════════════════════════════════════════════════════════════════════
     * ESCRIBIR. Y la previsualización va POR SEPARADO, con su propio controlador.
     * ═══════════════════════════════════════════════════════════════════════════════════
     *
     * ⚠️ MIRA LAS RUTAS Y VERÁS LA LEY DE LA TANDA DIBUJADA:
     *
     *     /preview   →  AssignmentPreviewController   NO escribe. NO bloquea. Sirve para PINTAR.
     *     POST/PATCH/DELETE  →  AssignmentController  ABRE EL CANDADO y RE-VALIDA dentro.
     *
     * Son dos controladores distintos porque son dos preguntas distintas, y el día que alguien las
     * junte «para no repetir» habrá reabierto el agujero del TOCTOU. Ver ESTRES-MOTOR.md §4.
     */
    Route::prefix('/companies/{company}/calendars/{calendar}/assignments')->group(function () {
        // La previsualización de COLOCAR (sin turno) y la de MOVER (con turno). No escriben.
        Route::post('/preview', AssignmentPreviewController::class)->name('assignments.preview');
        Route::post('/{assignment}/preview', AssignmentPreviewController::class)->name('assignments.preview.move');

        // Y las tres que sí escriben. Todas pasan por el candado.
        Route::post('/', [AssignmentController::class, 'store'])->name('assignments.store');
        Route::patch('/{assignment}', [AssignmentController::class, 'update'])->name('assignments.update');
        Route::delete('/{assignment}', [AssignmentController::class, 'destroy'])->name('assignments.destroy');

        // Las horas que se proponen al soltar a alguien en una celda vacía: el HUECO DE COBERTURA.
        Route::get('/hueco', SuggestedShiftController::class)->name('assignments.hueco');
    });
});
