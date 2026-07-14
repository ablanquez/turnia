<?php

namespace App\Http\Requests;

use App\Models\Assignment;
use App\Models\Calendar;
use App\Models\Company;
use App\Models\Employment;
use App\Models\Position;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Writing\Justificacion;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * LO QUE LLEGA DE LA PETICIÓN, CONVERTIDO EN UN DRAFT.
 *
 * ⚠️ ESTO SÍ SE COMPARTE ENTRE LA PREVISUALIZACIÓN Y LA DECISIÓN, Y NO ES UNA CONTRADICCIÓN.
 *
 * Lo que NO se puede compartir es el RESULTADO de validar: ese caduca en cuanto otro escribe.
 * Traducir «puesto 3, día 2026-07-13, de 12:00 a 20:00» a un `AssignmentDraft` NO caduca: es
 * parsear, no comprobar. Si esto estuviera duplicado, el peligro sería el contrario — que la
 * previsualización validara un draft y el candado validara OTRO, y entonces la previsualización
 * mentiría por construcción.
 *
 * Aquí la regla es: SE COMPARTE LA PREGUNTA. NO SE COMPARTE LA RESPUESTA.
 */
class AssignmentDraftRequest extends FormRequest
{
    /** La autorización va en el controlador, contra la Policy y con el modelo delante. */
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            /*
             * ⚠️ AL MOVER, EL CONTRATO NO VIAJA: es el del turno que se mueve. Nadie cambia de
             * persona arrastrando una barra — para eso se quita y se coloca otra.
             *
             * Y esto era `required_without:assignment`, que MIRA EL CUERPO de la petición. Pero
             * `assignment` es un parámetro de LA RUTA, no un campo: la condición nunca se cumplía,
             * así que al mover se exigía un `employmentId` que no se manda nunca, y la
             * previsualización devolvía 422 en silencio. Se veía arrastrando; no se ve leyendo.
             */
            'employmentId' => [Rule::requiredIf(fn () => $this->route('assignment') === null), 'integer'],
            'positionId' => ['required', 'integer'],
            'workDate' => ['required', 'date_format:Y-m-d'],

            /*
             * ⚠️ LAS HORAS SON DEL RELOJ DE LA EMPRESA, NO UTC. Y llegan como texto.
             *
             * "22:00" y "06:00" es un nocturno; el instante UTC lo calcula el servidor con la zona
             * de la empresa (Company::toUtc). Que el cliente mandara un instante sería pedirle que
             * supiera de zonas horarias y de cambios de hora — y el día que se equivoque, el turno
             * queda una hora corrido y NADIE lo nota, porque el dato es válido.
             */
            'start' => ['required', 'date_format:H:i'],
            'end' => ['required', 'regex:/^(?:[01]\d|2[0-4]):[0-5]\d$/'],

            // La decisión de forzar. Si no viene, no se fuerza nada.
            'force' => ['sometimes', 'array'],
            'force.reason' => ['required_with:force', 'string', 'min:3', 'max:2000'],
            'force.codes' => ['required_with:force', 'array', 'min:1'],
            'force.codes.*' => ['string'],
        ];
    }

    public function messages(): array
    {
        return [
            'force.reason.required_with' => 'Para forzar un turno hay que decir por qué. Es el único dato que esta aplicación no puede deducir sola.',
            'force.reason.min' => 'La justificación tiene que decir algo. «ok» no es un motivo.',
        ];
    }

    /**
     * El draft que se va a validar. Y es EL MISMO que validará el candado.
     *
     * $mueve = el turno que se está moviendo, si lo hay: se ignora al compararse consigo mismo (o
     * moverlo un minuto daría siempre un solape contra su propia versión vieja).
     */
    public function draft(Calendar $calendar, ?Assignment $mueve = null): AssignmentDraft
    {
        $company = $calendar->company;

        $employment = $mueve
            ? $mueve->employment
            : Employment::where('company_id', $company->id)->findOrFail($this->integer('employmentId'));

        // El puesto tiene que ser de ESTA empresa. Si no, un id ajeno colocaría a alguien en el
        // puesto de otro bar — y el motor lo validaría tan contento, porque el puesto existe.
        $position = Position::where('company_id', $company->id)->findOrFail($this->integer('positionId'));

        $workDate = CarbonImmutable::parse($this->string('workDate')->toString());

        return new AssignmentDraft(
            employment: $employment,
            position: $position,
            workDate: $workDate,
            startsAt: $company->toUtc($workDate->toDateString(), $this->string('start')->toString()),
            endsAt: $this->fin($company, $workDate),
            ignoreAssignmentId: $mueve?->id,
            calendarId: $calendar->id,
        );
    }

    public function justificacion(): ?Justificacion
    {
        if (! $this->has('force')) {
            return null;
        }

        return new Justificacion(
            motivo: trim($this->string('force.reason')->toString()),
            codigos: $this->input('force.codes', []),
        );
    }

    /**
     * ⚠️ EL FIN DE UN TURNO NO ES «LA HORA DE FIN DE ESE DÍA». Un nocturno acaba MAÑANA.
     *
     * Tres casos, y los tres tienen que salir bien o el turno se guarda con una duración negativa
     * (que el motor caza, `invalid_interval`) o con ocho horas de menos (que NO caza nadie):
     *
     *   22:00 → 06:00   el fin va antes que el inicio: acaba al día siguiente
     *   16:00 → 24:00   las 24:00 no existen en el reloj: son las 00:00 de mañana
     *   12:00 → 20:00   el caso normal
     *
     * Es la misma cuenta que hace el seeder, y por eso vive en UN sitio.
     */
    private function fin(Company $company, CarbonImmutable $workDate): CarbonImmutable
    {
        $end = $this->string('end')->toString();

        if ($end === '24:00') {
            return $company->toUtc($workDate->addDay()->toDateString(), '00:00');
        }

        $endsAt = $company->toUtc($workDate->toDateString(), $end);

        if ($endsAt->lte($company->toUtc($workDate->toDateString(), $this->string('start')->toString()))) {
            return $company->toUtc($workDate->addDay()->toDateString(), $end);
        }

        return $endsAt;
    }
}
