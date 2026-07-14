<?php

namespace App\Services\Scheduling\Writing;

/**
 * LA DECISIÓN HUMANA DE FORZAR. El único dato de toda la aplicación que NO SE DERIVA DE NADA.
 *
 * El incumplimiento se DERIVA (re-validando), y por eso no se guarda: depende de otras filas —una
 * baja nueva, un turno en el bar de al lado, un perfil que cambia— y un incumplimiento guardado se
 * volvería mentira sin que nadie lo tocara.
 *
 * Pero «quién decidió saltárselo, cuándo y POR QUÉ» no se deduce de ninguna fila. O se guarda, o se
 * pierde. Por eso `assignment_overrides` existe, y por eso el motivo es OBLIGATORIO: si se pudiera
 * dejar vacío, en tres semanas todas las justificaciones estarían vacías y el registro no valdría
 * nada — habríamos guardado una firma sin contrato.
 *
 * ⚠️ Y LOS CÓDIGOS NO SON DECORACIÓN: SON EL CONTRATO QUE EL USUARIO FIRMÓ.
 *
 * `codigos` son las reglas que se le ENSEÑARON cuando dijo «sí, fuerza». El candado los compara
 * con las que ve DENTRO, y si no coinciden NO ESCRIBE: le vuelve a preguntar. Sin esto, entre el
 * «¿fuerzas?» y el «sí» alguien podría cambiar el estado y acabaríamos apuntando en el expediente
 * de un empleado que su encargado aceptó una infracción que nadie le enseñó.
 */
final readonly class Justificacion
{
    /** @param  array<int, string>  $codigos  las reglas que se le enseñaron al decidir */
    public function __construct(
        public string $motivo,
        public array $codigos,
    ) {}

    /** @return array<int, string> */
    public function codigosOrdenados(): array
    {
        $codigos = array_values(array_unique($this->codigos));
        sort($codigos);

        return $codigos;
    }
}
