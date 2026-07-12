<?php

namespace Tests\Support;

/**
 * La receta de un negocio: qué realidad estresa y con qué parámetros.
 *
 * No son variaciones del mismo bar. Cada uno aprieta el motor por un flanco:
 * jornada partida, 24/7, turno de madrugada, cierre estacional, año de cómputo
 * móvil, volumen, overrides individuales...
 */
final readonly class BusinessBlueprint
{
    public function __construct(
        public string $key,
        public string $name,
        /** Qué tensión concreta mete en el motor. Va al informe. */
        public string $stresses,
        public int $employees,
        /** @var array<int, string> */
        public array $positions,
        /** @var array<int, array{name: string, limits: array}> */
        public array $profiles,
        /** @var array<int, array{position: string, days: array<int>, from: string, to: string, count: int}> */
        public array $coverage,
        public array $companyAttributes = [],
        /** Empleados con override individual: 0 = ninguno, 1 = todos. */
        public float $overrideRatio = 0.0,
        /** Meses del año en los que el negocio NO abre. */
        public array $closedMonths = [],
        public array $holidays = [],
    ) {}
}
