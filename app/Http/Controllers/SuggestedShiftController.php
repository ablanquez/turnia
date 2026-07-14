<?php

namespace App\Http\Controllers;

use App\Models\Calendar;
use App\Models\Company;
use App\Services\Scheduling\CoverageCalculator;
use App\Services\Scheduling\CoverageSegment;
use App\Services\Scheduling\WindowResolver;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * LAS HORAS QUE SE PROPONEN AL SOLTAR A ALGUIEN EN UNA CELDA VACÍA.
 *
 * ⚠️ Y LAS DECIDE EL SERVIDOR, NO EL CLIENTE. Eso no es celo: es que el cliente NO LAS SABE.
 *
 * La cobertura viaja como prop DIFERIDA (llega ~700 ms después del primer pintado). Si el cliente
 * dedujera las horas de su copia, un usuario rápido —o uno con la red lenta— soltaría una barra
 * antes de que esa prop hubiera llegado, y el hueco saldría vacío o, peor, viejo. La respuesta
 * correcta no puede depender de si un dato asíncrono ya llegó.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * QUÉ SE PROPONE, Y EN QUÉ ORDEN:
 *
 *   1. EL PRIMER TRAMO DESCUBIERTO de ese puesto ese día  → «colócalo donde falta gente»
 *   2. Si todo está cubierto, el primer tramo QUE SE PIDE  → hay demanda, aunque esté servida
 *   3. Si no se pide nada ahí, NADA                        → y el popover sale vacío
 *
 * El paso 3 no es un fallo: es la verdad. Si nadie ha declarado que ese puesto necesita gente ese
 * día, la aplicación NO SABE a qué hora entra nadie, y inventarse un «09:00–17:00 por defecto»
 * sería fabricar un dato con aspecto de dato. Que lo escriba el humano, que sí lo sabe.
 *
 * ⚠️ ESTO NO VALIDA NADA Y NO DECIDE NADA. Es una sugerencia para rellenar dos campos de texto.
 * Lo que se escriba en ellos lo validará el candado, como todo lo demás.
 */
class SuggestedShiftController extends Controller
{
    public function __construct(
        private CoverageCalculator $coverage,
        private WindowResolver $windows,
    ) {}

    public function __invoke(Request $request, Company $company, Calendar $calendar): JsonResponse
    {
        abort_unless($calendar->company_id === $company->id, 404);

        Gate::authorize('manage', $calendar);

        $validated = $request->validate([
            'positionId' => ['required', 'integer'],
            'workDate' => ['required', 'date_format:Y-m-d'],
        ]);

        $date = CarbonImmutable::parse($validated['workDate']);

        // Un solo día: la cobertura de una semana cuesta; la de un día, nada.
        $segments = $this->coverage
            ->forCalendar($calendar, $this->windows->day($date))
            ->segments
            ->filter(fn (CoverageSegment $s) => $s->position->id === (int) $validated['positionId'])
            ->filter(fn (CoverageSegment $s) => $s->workDate->isSameDay($date))
            ->values();

        $hueco = $segments->first(fn (CoverageSegment $s) => $s->isGap())
            ?? $segments->first(fn (CoverageSegment $s) => $s->required > 0);

        if (! $hueco) {
            // ⚠️ Se dice que no hay sugerencia. No se inventa una.
            return response()->json(['start' => null, 'end' => null, 'motivo' => 'no se pide a nadie en este puesto ese día']);
        }

        $start = $company->localTime($hueco->startsAt);
        $end = $this->fin($company->localTime($hueco->endsAt), $start);

        return response()->json([
            'start' => $start,
            'end' => $end,
            'motivo' => $hueco->isGap()
                ? sprintf('faltan %d de %s a %s', $hueco->missing(), $start, $end)
                : 'el tramo que se pide en este puesto',
        ]);
    }

    /**
     * ⚠️ UN TRAMO QUE ACABA A MEDIANOCHE DEVUELVE «00:00», Y ESO EN UN CAMPO DE FIN ES UNA TRAMPA.
     *
     * «12:00 → 00:00» se lee como un turno que va hacia atrás. Es la misma medianoche, contada
     * desde el otro lado: en un campo de FIN, las 24:00 dicen la verdad y las 00:00 confunden.
     * (El servidor entiende las dos: ver AssignmentDraftRequest::fin.)
     */
    private function fin(string $end, string $start): string
    {
        return $end === '00:00' && $start !== '00:00' ? '24:00' : $end;
    }
}
