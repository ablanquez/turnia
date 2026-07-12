<?php

namespace App\Http\Controllers;

use App\Models\Calendar;
use App\Models\Company;
use App\Services\Scheduling\Presentation\SchedulePayload;
use App\Services\Scheduling\Presentation\ScheduleScope;
use App\Services\Scheduling\WindowResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class ScheduleController extends Controller
{
    public function __construct(
        private SchedulePayload $payload,
        private WindowResolver $windows,
    ) {}

    public function week(Request $request, Company $company, Calendar $calendar): Response
    {
        // Fail-closed: si el que mira no es dueño, ni encargado, ni trabaja aquí, 403.
        Gate::authorize('view', $calendar);

        abort_unless($calendar->company_id === $company->id, 404);

        $scope = ScheduleScope::for($request->user(), $company);
        $window = $this->windows->week($this->requestedDate($request));

        return Inertia::render('Schedule/Week', [
            ...$this->payload->build($calendar, $window, $scope),

            /*
             * EL INFORME DE INCUMPLIMIENTOS VA DIFERIDO, Y ESTA ES LA DECISIÓN MÁS
             * IMPORTANTE DE LA VISTA.
             *
             * Medido: 719 ms y ~1.700 consultas para una semana en el mundo de estrés.
             * Es el precio de DERIVAR los incumplimientos en vez de guardarlos, que es
             * justo lo que impide que mientan (un incumplimiento depende de OTRAS filas:
             * una baja nueva, un turno en el bar de al lado, un perfil que cambia; uno
             * guardado se volvería mentira sin que nadie lo tocara).
             *
             * Meterlo en la carga haría que la parrilla tardara un segundo en aparecer y
             * la app se sentiría rota, sin que fuera culpa del motor sino de dónde lo
             * pusimos. Así, la rejilla se pinta al instante y los avisos llegan detrás.
             *
             * ⚠️ COROLARIO, y es el que de verdad importa: mientras esta prop no ha
             * llegado, LA AUSENCIA DE ROJO NO SIGNIFICA "TODO CORRECTO". Por eso el
             * fallback de la vista dice "comprobando incumplimientos…" y no pinta nada en
             * verde. Si pintáramos verde por defecto habríamos fabricado un silencio
             * falso en la interfaz, que es el veneno que llevamos cinco tandas evitando.
             *
             * Y por eso mismo NO se cachea: una caché de incumplimientos es el contador
             * acumulado del que huimos. Habría que invalidarla por eventos de tres tablas
             * y de la empresa vecina, y una caché mal invalidada aquí es, otra vez, un
             * silencio falso.
             */
            'violations' => Inertia::defer(
                fn () => $this->payload->violations($company, $window, $scope)
            ),
        ]);
    }

    /** ?week=2026-07-06 → la semana de esa fecha. Sin parámetro, la de hoy. */
    private function requestedDate(Request $request): CarbonImmutable
    {
        $requested = $request->query('week');

        if (! is_string($requested)) {
            return CarbonImmutable::today();
        }

        return rescue(
            fn () => CarbonImmutable::parse($requested),
            fn () => CarbonImmutable::today(),
            report: false,
        );
    }
}
