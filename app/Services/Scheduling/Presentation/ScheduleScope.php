<?php

namespace App\Services\Scheduling\Presentation;

use App\Models\Company;
use App\Models\User;

/**
 * QUÉ PORCIÓN DE LOS DATOS VE EL QUE MIRA.
 *
 * La autorización de Turnia no es "puedes entrar o no": es "qué ves". Las policies
 * abren la puerta; esto decide qué hay dentro de la habitación.
 *
 * Se deriva UNA VEZ, al construir la vista, y desde ahí gobierna todas las
 * consultas. Preguntar la policy fila a fila costaría una consulta por fila y, lo
 * que es peor, dejaría la puerta abierta a olvidarse de preguntar en un sitio.
 */
final readonly class ScheduleScope
{
    private function __construct(
        /** Dueño: las otras empresas de la persona también son suyas. */
        public bool $isOwner,
        /** Dueño o encargado: ve los datos personales de toda la plantilla. */
        public bool $canManage,
        /** Si mira un empleado, su persona. null si no lo es. */
        public ?int $viewerPersonId,
    ) {}

    public static function for(User $user, Company $company): self
    {
        return new self(
            isOwner: $user->owns($company),
            canManage: $user->canManage($company),
            viewerPersonId: $user->person_id,
        );
    }

    /**
     * ¿Puede ver las bajas y los conceptos horarios de esta persona?
     *
     * Son datos de SALUD. El empleado solo ve los suyos: verá el hueco que deja el
     * compañero de baja, pero no sabrá por qué, y eso es exactamente lo correcto.
     */
    public function seesPersonalDataOf(int $personId): bool
    {
        return $this->canManage || $personId === $this->viewerPersonId;
    }

    /**
     * ¿Puede saber el NOMBRE de la otra empresa en la que trabaja alguien?
     *
     * Solo el dueño, porque los dos bares son suyos. Al encargado del Bar A no le
     * corresponde saber que su camarera hace además turnos en el Bar B: le basta
     * con saber que ese día está comprometida en otro sitio.
     */
    public function seesOtherCompanyNames(): bool
    {
        return $this->isOwner;
    }

    /** El panel de plantilla lleva contadores de horas: es dato laboral. */
    public function seesStaffPanel(): bool
    {
        return $this->canManage;
    }
}
