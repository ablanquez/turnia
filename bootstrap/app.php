<?php

use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        /*
         * ⚠️ ESTA REGLA ESTABA ESTRECHANDO EL COMPORTAMIENTO POR DEFECTO DE LARAVEL, Y PARA NADA.
         *
         * Decía «devuelve JSON solo bajo /api/*», y en Turnia NO HAY NINGUNA RUTA /api/*. O sea que
         * la condición era siempre falsa y TODA excepción se renderizaba como HTML — incluidas las
         * de validación de una petición que pedía JSON, que salían como un redirect a la portada.
         *
         * Lo destapó la tanda de escribir: los tres endpoints que escriben son JSON (no son
         * navegaciones; nadie escribe esas URLs). Un fallo de validación les llegaba como una
         * página de redirección, y el cliente no tenía forma de leer el motivo.
         *
         * Ahora vale la regla de Laravel: si el que pide dice que espera JSON, se le da JSON.
         *
         * ⚠️ Y NO ROMPE A INERTIA, que era lo que la regla vieja protegía: una petición de Inertia
         * manda `Accept: text/html`, así que `expectsJson()` es FALSO para ella y sus errores de
         * validación siguen volviendo como un redirect con la bolsa de errores en sesión. Se
         * comprueba en AssignmentEndpointsTest.
         */
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
