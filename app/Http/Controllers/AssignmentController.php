<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignmentDraftRequest;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Services\Scheduling\Writing\AssignmentWriter;
use App\Services\Scheduling\Writing\Decision;
use App\Services\Scheduling\Writing\Resultado;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * EL QUE DECIDE. Y no valida nada por su cuenta: se lo pide al candado.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ FÍJATE EN LO QUE ESTE CONTROLADOR **NO** HACE: no llama al validador.
 *
 * No puede. La validación que decide vive DENTRO de la transacción de AssignmentWriter, con la
 * persona bloqueada. Si este controlador validara aquí —fuera del candado— y luego le pasara el
 * resultado al writer, habríamos reconstruido el agujero: entre la comprobación y la escritura
 * cabe otra escritura.
 *
 * Por eso el writer no acepta un `ValidationResult`. Y por eso aquí no hay ninguno.
 *
 * ───────────────────────────────────────────────────────────────────────────────────────
 * ⚠️ POR QUÉ ESTO DEVUELVE JSON Y NO UNA RESPUESTA DE INERTIA
 * ───────────────────────────────────────────────────────────────────────────────────────
 *
 * Estas tres rutas NO son navegaciones: nadie escribe estas URLs, y soltar una barra no cambia de
 * página. Son llamadas de una capa de arrastre, y dos de sus tres desenlaces —«no puedo» y «hace
 * falta que decidas»— NO ESCRIBEN NADA.
 *
 * Si respondieran con un redirect de Inertia, esos dos casos provocarían un re-renderizado entero
 * de la página —y con él, otra vez el informe diferido, 719 ms— PARA NO HABER ESCRITO NADA. Sería
 * pagar el precio más caro de la app por una respuesta que solo dice «no».
 *
 * Cuando SÍ se escribe, es el cliente quien pide el repintado (`router.reload()`): la escritura
 * responde en milisegundos, la barra aparece en su sitio, y el informe llega detrás — con el mismo
 * fallback honesto de siempre («comprobando el cuadrante…», nunca verde).
 *
 * ⚠️ Y eso resuelve solo lo de «mover un turno puede romper OTRO». La escritura no lo calcula: no
 * le hace falta. El informe diferido lo dice sobre el estado REAL y para toda la semana, y la barra
 * del otro se pinta en rojo sin que la escritura sepa nada de él.
 */
class AssignmentController extends Controller
{
    public function __construct(private AssignmentWriter $writer) {}

    /** COLOCAR: desde el panel de plantilla a una celda. */
    public function store(AssignmentDraftRequest $request, Company $company, Calendar $calendar): JsonResponse
    {
        $this->mismoCalendario($company, $calendar);

        $draft = $request->draft($calendar);

        /*
         * La Policy pregunta por la EMPRESA del turno, y esa se deriva del contrato — nunca del
         * cliente. Un encargado del Bar A no puede colocar en el Bar B ni mandando el id correcto:
         * el turno que se autoriza es el que se va a escribir.
         */
        $futuro = new Assignment(['employment_id' => $draft->employment->id]);
        $futuro->company_id = $draft->employment->company_id;

        Gate::authorize('create', $futuro);

        return $this->responder(
            $this->writer->place($draft, $request->user(), $request->justificacion())
        );
    }

    /** MOVER: otro día, otro puesto, otras horas. La persona no cambia. */
    public function update(AssignmentDraftRequest $request, Company $company, Calendar $calendar, Assignment $assignment): JsonResponse
    {
        $this->mismoCalendario($company, $calendar);
        abort_unless($assignment->calendar_id === $calendar->id, 404);

        Gate::authorize('update', $assignment);

        return $this->responder(
            $this->writer->move($assignment, $request->draft($calendar, $assignment), $request->user(), $request->justificacion())
        );
    }

    /** QUITAR. */
    public function destroy(Request $request, Company $company, Calendar $calendar, Assignment $assignment): JsonResponse
    {
        $this->mismoCalendario($company, $calendar);
        abort_unless($assignment->calendar_id === $calendar->id, 404);

        Gate::authorize('delete', $assignment);

        return $this->responder($this->writer->remove($assignment));
    }

    /**
     * LOS TRES DESENLACES, Y SUS TRES CÓDIGOS. Cada uno dice una cosa distinta al cliente.
     *
     *   200  escrito / quitado          → la parrilla se repinta
     *   422  imposible                  → NO se ha escrito. Se explica por qué y la barra vuelve.
     *   409  hace falta que decidas     → NO se ha escrito. Se pregunta si se fuerza.
     *
     * 409 y no 422 para el incumplimiento, y la diferencia importa: 422 es «tu petición no es
     * válida» (culpa del que pide) y 409 es «el estado actual no lo permite tal cual» (no es culpa
     * de nadie: hay un conflicto que un humano tiene que resolver). Forzar es exactamente eso.
     */
    private function responder(Decision $decision): JsonResponse
    {
        return match ($decision->resultado) {
            Resultado::Escrito => response()->json([
                'resultado' => 'escrito',
                'forzado' => $decision->forzado,
                // ⚠️ «Ibas a forzar, y para cuando llegaste ya no hacía falta.» Se dice.
                'cambioElEstado' => $decision->cambioElEstado,
                'assignmentId' => $decision->assignment?->id,
            ]),

            Resultado::Quitado => response()->json(['resultado' => 'quitado']),

            Resultado::Imposible => response()->json([
                'resultado' => 'imposible',
                'violations' => $decision->violations,
            ], 422),

            Resultado::NecesitaDecision => response()->json([
                'resultado' => 'necesita_decision',
                'violations' => $decision->violations,
                // ⚠️ «Justificaste una cosa y ahora incumple otra.» Se vuelve a preguntar.
                'cambioElEstado' => $decision->cambioElEstado,
            ], 409),
        };
    }

    private function mismoCalendario(Company $company, Calendar $calendar): void
    {
        abort_unless($calendar->company_id === $company->id, 404);
    }
}
