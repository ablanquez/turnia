<?php

namespace App\Http\Controllers;

use App\Http\Requests\AssignmentDraftRequest;
use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ValidationResult;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * LA PREVISUALIZACIÓN. NO DECIDE NADA. NO ESCRIBE NADA. NO BLOQUEA NADA.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * ⚠️ ESTE CONTROLADOR EXISTE SEPARADO DE AssignmentController **A PROPÓSITO**, Y ESA SEPARACIÓN
 * ES LA DEFENSA PRINCIPAL DE ESTA TANDA.
 *
 * Si las dos cosas vivieran en el mismo controlador, el día que alguien «refactorice para no
 * repetir» fundiría la validación de la previsualización con la de la decisión — y REABRIRÍA EL
 * AGUJERO ENTERO, con las mejores intenciones y en un commit que parecería una limpieza.
 *
 * Así que están en clases distintas, con nombres distintos, y **solo una de las dos abre una
 * transacción**. Aquí la duplicación no es deuda: es el muro.
 *
 *     LO QUE ESTO DEVUELVE ES UNA FOTO DEL ESTADO DE HACE UN MOMENTO.
 *     PARA CUANDO EL USUARIO SUELTE EL RATÓN, PUEDE SER MENTIRA.
 *     Y NO PASA NADA, PORQUE ESTO NO DECIDE: SIRVE PARA PINTAR.
 *
 * La que decide es la que corre DENTRO del candado (AssignmentWriter). Y esa se llama otra vez,
 * siempre, aunque esta acabe de decir que todo estaba bien.
 */
class AssignmentPreviewController extends Controller
{
    public function __construct(private AssignmentValidator $validator) {}

    public function __invoke(
        AssignmentDraftRequest $request,
        Company $company,
        Calendar $calendar,
        ?Assignment $assignment = null,
    ): JsonResponse {
        abort_unless($calendar->company_id === $company->id, 404);

        /*
         * ⚠️ LA PREVISUALIZACIÓN TAMBIÉN SE AUTORIZA, Y NO ES UN EXCESO DE CELO.
         *
         * No escribe, pero DICE COSAS: «Sara ya tiene un turno de 22:00 a 06:00 en el Bar Central».
         * Eso es información de la plantilla, y un empleado no tiene por qué poder sonsacarla
         * arrastrando barras que nunca va a poder soltar. Un endpoint de solo lectura que filtra
         * datos es una fuga, no una lectura inofensiva.
         */
        Gate::authorize('manage', $calendar);

        if ($assignment) {
            abort_unless($assignment->calendar_id === $calendar->id, 404);
        }

        $draft = $request->draft($calendar, $assignment);
        $result = $this->validator->validate($draft);

        return response()->json([
            /*
             * Esta marca no la lee ni una línea de código. Está aquí para el humano que abra las
             * herramientas del navegador, vea este JSON y se pregunte si puede fiarse de él.
             */
            'esUnaPrevisualizacion' => true,

            'severidad' => $this->severidad($result),
            'violations' => $result->toArray(),
        ]);
    }

    /** La peor gravedad. La misma escala que pinta la parrilla: impossible > breach > notice. */
    private function severidad(ValidationResult $result): ?string
    {
        if (! $result->isPossible()) {
            return 'impossible';
        }

        if ($result->breaches()->isNotEmpty()) {
            return 'breach';
        }

        if ($result->notices()->isNotEmpty()) {
            return 'notice';
        }

        return null;
    }
}
