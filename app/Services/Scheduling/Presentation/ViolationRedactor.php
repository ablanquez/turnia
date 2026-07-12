<?php

namespace App\Services\Scheduling\Presentation;

use App\Enums\RuleCode;
use App\Services\Scheduling\Validation\ValidationResult;
use App\Services\Scheduling\Validation\Violation;

/**
 * EL MOTOR SABE LA VERDAD ENTERA. LA PANTALLA NO SIEMPRE PUEDE ENSEÑARLA.
 *
 * El aviso de jornada compartida dice, literalmente:
 *
 *     "Ese día también trabaja en Bar Central (09:00-14:00)."
 *
 * y su contexto lleva los ids de la otra empresa y de sus turnos. Eso es correcto
 * para el motor y para el dueño (los dos bares son suyos), pero NO se le puede
 * enseñar al encargado del Bar A: el dato del Bar B no es suyo.
 *
 * ⚠️ LA REDACCIÓN VIVE AQUÍ Y NO EN EL MOTOR, Y ES UNA DECISIÓN, NO UNA COMODIDAD.
 *
 * Si mutilara la regla "por privacidad", el motor dejaría de saber una cosa que
 * necesita saber, y el informe, el simulador y la futura parrilla que escribe
 * heredarían la mutilación. Sería meter un silencio falso en el sitio más caro de
 * todos. El motor sigue sabiéndolo todo; la que decide qué se enseña es la capa
 * que conoce a quien mira, que es esta.
 */
final readonly class ViolationRedactor
{
    public function __construct(private ScheduleScope $scope) {}

    /** @return array<int, array> */
    public function apply(ValidationResult $result): array
    {
        return $result->violations
            ->map(fn (Violation $v) => $this->redact($v))
            ->all();
    }

    private function redact(Violation $violation): array
    {
        $raw = $violation->toArray();

        if ($violation->code !== RuleCode::SharedWorkday || $this->scope->seesOtherCompanyNames()) {
            return $raw;
        }

        // El aviso SIGUE APARECIENDO: el encargado tiene que saber que esa persona
        // está comprometida en otro sitio ese día, o le dará una jornada que no
        // puede cumplir. Lo que desaparece es el nombre, la hora y los ids.
        return [
            ...$raw,
            'message' => 'Ese día también trabaja en otra empresa.',
            'context' => [],
        ];
    }
}
