<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ScheduleController;
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
});
