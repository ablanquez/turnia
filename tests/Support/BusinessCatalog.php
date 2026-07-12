<?php

namespace Tests\Support;

use App\Enums\WorkdayType;

/**
 * LOS 20 NEGOCIOS.
 *
 * Cada uno estresa el motor por un flanco distinto. Los límites van en MINUTOS.
 * Los días de la semana son ISO (1 = lunes ... 7 = domingo).
 */
class BusinessCatalog
{
    /** @return array<int, BusinessBlueprint> */
    public static function all(): array
    {
        return [
            // ─────────── TURNOS Y JORNADA ───────────

            new BusinessBlueprint(
                key: 'tapas',
                name: 'Bar de Tapas El Rincón',
                stresses: 'Jornada partida masiva y refuerzo de fin de semana.',
                employees: 8,
                positions: ['Barra', 'Cocina', 'Sala'],
                profiles: [
                    ['name' => 'Completa partida', 'limits' => [
                        'max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720,
                        'max_minutes_per_shift' => 360, 'workday_type' => WorkdayType::Split,
                        'annual_leave_days' => 22, 'max_overtime_minutes_year' => 4800,
                    ]],
                    ['name' => 'Parcial tarde', 'limits' => [
                        'max_minutes_week' => 1200, 'min_rest_minutes_between_shifts' => 720,
                        'annual_leave_days' => 11,
                    ]],
                ],
                coverage: [
                    ['position' => 'Barra', 'days' => [1, 2, 3, 4, 5], 'from' => '12:00', 'to' => '16:00', 'count' => 2],
                    ['position' => 'Barra', 'days' => [1, 2, 3, 4, 5], 'from' => '20:00', 'to' => '23:59', 'count' => 2],
                    ['position' => 'Barra', 'days' => [6, 7], 'from' => '12:00', 'to' => '16:00', 'count' => 3],
                    ['position' => 'Cocina', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '12:00', 'to' => '16:00', 'count' => 1],
                ],
            ),

            new BusinessBlueprint(
                key: 'restaurante',
                name: 'Restaurante Casa Lucía',
                stresses: 'Dos servicios al día y cierre fijo un día entre semana.',
                employees: 10,
                positions: ['Cocina', 'Sala', 'Office'],
                profiles: [
                    ['name' => 'Completa', 'limits' => [
                        'max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720,
                        'workday_type' => WorkdayType::Split, 'annual_leave_days' => 30,
                    ]],
                ],
                coverage: [
                    ['position' => 'Cocina', 'days' => [3, 4, 5, 6, 7], 'from' => '12:00', 'to' => '16:00', 'count' => 2],
                    ['position' => 'Cocina', 'days' => [3, 4, 5, 6, 7], 'from' => '20:00', 'to' => '23:59', 'count' => 2],
                    ['position' => 'Sala', 'days' => [3, 4, 5, 6, 7], 'from' => '12:00', 'to' => '16:00', 'count' => 2],
                ],
                companyAttributes: ['non_working_weekdays' => [2]], // cierra los martes
            ),

            new BusinessBlueprint(
                key: 'residencia',
                name: 'Residencia Los Robles',
                stresses: '24/7 con tres turnos rotativos y ratio mínimo legal.',
                employees: 24,
                positions: ['Auxiliar', 'Enfermería', 'Cocina', 'Limpieza'],
                profiles: [
                    ['name' => 'Turnos rotativos', 'limits' => [
                        'max_minutes_week' => 2280, 'max_minutes_year' => 102000,
                        'min_rest_minutes_between_shifts' => 720, 'max_minutes_per_shift' => 480,
                        'workday_type' => WorkdayType::Continuous, 'annual_leave_days' => 30,
                    ]],
                ],
                coverage: [
                    ['position' => 'Auxiliar', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '07:00', 'to' => '15:00', 'count' => 4],
                    ['position' => 'Auxiliar', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '15:00', 'to' => '23:00', 'count' => 3],
                    ['position' => 'Auxiliar', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '23:00', 'to' => '07:00', 'count' => 2],
                    ['position' => 'Enfermería', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '07:00', 'to' => '15:00', 'count' => 1],
                ],
                companyAttributes: ['non_working_weekdays' => []], // no cierra nunca
            ),

            new BusinessBlueprint(
                key: 'hospital',
                name: 'Clínica San Marcos',
                stresses: 'Guardias largas y personal muy cualificado: poca sustituibilidad.',
                employees: 14,
                positions: ['Urgencias', 'Quirófano', 'Radiología'],
                profiles: [
                    ['name' => 'Guardia', 'limits' => [
                        'max_minutes_week' => 2880, 'min_rest_minutes_between_shifts' => 720,
                        'max_minutes_per_shift' => 720, 'annual_leave_days' => 25,
                        'max_overtime_minutes_year' => 9000,
                    ]],
                ],
                coverage: [
                    ['position' => 'Urgencias', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '08:00', 'to' => '20:00', 'count' => 2],
                    ['position' => 'Urgencias', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '20:00', 'to' => '08:00', 'count' => 1],
                ],
                companyAttributes: ['non_working_weekdays' => []],
            ),

            new BusinessBlueprint(
                key: 'seguridad',
                name: 'Vigilancia Aral',
                stresses: '24/7 puro con rotación cíclica en varios emplazamientos.',
                employees: 12,
                positions: ['Puerta', 'Ronda', 'CCTV'],
                profiles: [
                    ['name' => 'Vigilante', 'limits' => [
                        'max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720,
                        'max_minutes_per_shift' => 720, 'workday_type' => WorkdayType::Continuous,
                    ]],
                ],
                coverage: [
                    ['position' => 'Puerta', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '06:00', 'to' => '18:00', 'count' => 1],
                    ['position' => 'Puerta', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '18:00', 'to' => '06:00', 'count' => 1],
                    ['position' => 'CCTV', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '22:00', 'to' => '06:00', 'count' => 1],
                ],
                companyAttributes: ['non_working_weekdays' => []],
            ),

            new BusinessBlueprint(
                key: 'panaderia',
                name: 'Panadería La Espiga',
                stresses: 'Turno de madrugada (03:00-11:00) y plantilla mínima.',
                employees: 4,
                positions: ['Obrador', 'Despacho'],
                profiles: [
                    ['name' => 'Obrador', 'limits' => [
                        'max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720,
                        'workday_type' => WorkdayType::Continuous, 'annual_leave_days' => 22,
                    ]],
                ],
                coverage: [
                    ['position' => 'Obrador', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '03:00', 'to' => '11:00', 'count' => 2],
                    ['position' => 'Despacho', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '08:00', 'to' => '14:00', 'count' => 1],
                ],
            ),

            new BusinessBlueprint(
                key: 'discoteca',
                name: 'Sala Neón',
                stresses: 'Solo viernes y sábado, y SIEMPRE cruzando medianoche.',
                employees: 9,
                positions: ['Barra', 'Puerta', 'Cabina'],
                profiles: [
                    ['name' => 'Fin de semana', 'limits' => [
                        'max_minutes_week' => 1200, 'min_rest_minutes_between_shifts' => 720,
                        'max_minutes_per_shift' => 480,
                    ]],
                ],
                coverage: [
                    ['position' => 'Barra', 'days' => [5, 6], 'from' => '23:00', 'to' => '06:00', 'count' => 3],
                    ['position' => 'Puerta', 'days' => [5, 6], 'from' => '23:00', 'to' => '06:00', 'count' => 2],
                ],
                companyAttributes: ['non_working_weekdays' => [1, 2, 3, 4, 7]],
            ),

            new BusinessBlueprint(
                key: 'moda',
                name: 'Moda Zeta',
                stresses: 'Muchos contratos parciales (12h/16h/20h) y picos de campaña.',
                employees: 18,
                positions: ['Caja', 'Probadores', 'Almacén', 'Sala'],
                profiles: [
                    ['name' => 'Parcial 12h', 'limits' => ['max_minutes_week' => 720, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 11]],
                    ['name' => 'Parcial 16h', 'limits' => ['max_minutes_week' => 960, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 15]],
                    ['name' => 'Parcial 20h', 'limits' => ['max_minutes_week' => 1200, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 18]],
                ],
                coverage: [
                    ['position' => 'Caja', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '10:00', 'to' => '14:00', 'count' => 2],
                    ['position' => 'Caja', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '17:00', 'to' => '21:00', 'count' => 2],
                    ['position' => 'Sala', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '10:00', 'to' => '21:00', 'count' => 2],
                ],
            ),

            new BusinessBlueprint(
                key: 'super',
                name: 'Supermercado Ahorro',
                stresses: 'Horario continuo, reposición nocturna y cajas escalonadas.',
                employees: 22,
                positions: ['Caja', 'Reposición', 'Frescos', 'Carnicería'],
                profiles: [
                    ['name' => 'Completa', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 22]],
                    ['name' => 'Nocturno', 'limits' => ['max_minutes_week' => 2100, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 25]],
                ],
                coverage: [
                    ['position' => 'Caja', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '09:00', 'to' => '15:00', 'count' => 3],
                    ['position' => 'Caja', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '15:00', 'to' => '21:00', 'count' => 4],
                    ['position' => 'Reposición', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '22:00', 'to' => '06:00', 'count' => 2],
                ],
            ),

            new BusinessBlueprint(
                key: 'hotel',
                name: 'Hotel Miramar',
                stresses: 'Recepción 24/7 y temporada alta/baja brutal.',
                employees: 20,
                positions: ['Recepción', 'Limpieza', 'Desayunos', 'Mantenimiento'],
                profiles: [
                    ['name' => 'Recepción', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'max_minutes_per_shift' => 480]],
                    ['name' => 'Limpieza', 'limits' => ['max_minutes_week' => 2100, 'min_rest_minutes_between_shifts' => 600]],
                ],
                coverage: [
                    ['position' => 'Recepción', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '07:00', 'to' => '15:00', 'count' => 2],
                    ['position' => 'Recepción', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '15:00', 'to' => '23:00', 'count' => 2],
                    ['position' => 'Recepción', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '23:00', 'to' => '07:00', 'count' => 1],
                    ['position' => 'Limpieza', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '09:00', 'to' => '15:00', 'count' => 4],
                ],
                companyAttributes: ['non_working_weekdays' => []],
            ),

            // ─────────── CASOS QUE ROMPEN SUPUESTOS ───────────

            new BusinessBlueprint(
                key: 'peluqueria',
                name: 'Peluquería Nuria',
                stresses: 'CASO MÍNIMO: 3 empleados. ¿El motor funciona con casi nada?',
                employees: 3,
                positions: ['Peluquería'],
                profiles: [
                    ['name' => 'Completa', 'limits' => ['max_minutes_week' => 2400, 'annual_leave_days' => 22]],
                ],
                coverage: [
                    ['position' => 'Peluquería', 'days' => [2, 3, 4, 5, 6], 'from' => '10:00', 'to' => '14:00', 'count' => 2],
                ],
            ),

            new BusinessBlueprint(
                key: 'libra_lunes',
                name: 'Floristería Domingo',
                stresses: 'Libra el LUNES, no el domingo. non_working_weekdays = [1].',
                employees: 5,
                positions: ['Mostrador', 'Reparto'],
                profiles: [
                    ['name' => 'Completa', 'limits' => ['max_minutes_week' => 2400, 'annual_leave_days' => 22]],
                ],
                coverage: [
                    ['position' => 'Mostrador', 'days' => [2, 3, 4, 5, 6, 7], 'from' => '10:00', 'to' => '14:00', 'count' => 2],
                ],
                companyAttributes: ['non_working_weekdays' => [1]],
            ),

            new BusinessBlueprint(
                key: 'ano_septiembre',
                name: 'Academia Cervantes',
                stresses: 'Año de cómputo desde el 1 de SEPTIEMBRE, no natural.',
                employees: 8,
                positions: ['Docencia', 'Secretaría'],
                profiles: [
                    ['name' => 'Docente', 'limits' => [
                        'max_minutes_year' => 60000, 'max_minutes_week' => 1500,
                        'annual_leave_days' => 30, 'max_overtime_minutes_year' => 3000,
                    ]],
                ],
                coverage: [
                    ['position' => 'Docencia', 'days' => [1, 2, 3, 4, 5], 'from' => '16:00', 'to' => '21:00', 'count' => 3],
                ],
                companyAttributes: ['computation_year_start_month' => 9, 'computation_year_start_day' => 1],
            ),

            new BusinessBlueprint(
                key: 'sin_limites',
                name: 'Consultora Nébula',
                stresses: 'TODOS los perfiles sin límites (todo null). ¿Valida algo?',
                employees: 6,
                positions: ['Consultoría'],
                profiles: [
                    ['name' => 'Sin condiciones', 'limits' => []],
                ],
                coverage: [
                    ['position' => 'Consultoría', 'days' => [1, 2, 3, 4, 5], 'from' => '09:00', 'to' => '18:00', 'count' => 2],
                ],
            ),

            new BusinessBlueprint(
                key: 'unipersonal',
                name: 'Quiosco Manoli',
                stresses: 'UN solo empleado que lo cubre todo.',
                employees: 1,
                positions: ['Mostrador'],
                profiles: [
                    ['name' => 'Autónoma', 'limits' => ['max_minutes_week' => 3000, 'annual_leave_days' => 22]],
                ],
                coverage: [
                    ['position' => 'Mostrador', 'days' => [1, 2, 3, 4, 5, 6], 'from' => '08:00', 'to' => '14:00', 'count' => 1],
                ],
            ),

            new BusinessBlueprint(
                key: 'estacional',
                name: 'Chiringuito Las Olas',
                stresses: 'Cerrado 4 meses al año: cobertura CERO en invierno.',
                employees: 12,
                positions: ['Barra', 'Cocina', 'Terraza'],
                profiles: [
                    ['name' => 'Temporada', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 600]],
                ],
                coverage: [
                    ['position' => 'Barra', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '12:00', 'to' => '20:00', 'count' => 3],
                    ['position' => 'Terraza', 'days' => [1, 2, 3, 4, 5, 6, 7], 'from' => '12:00', 'to' => '20:00', 'count' => 2],
                ],
                closedMonths: [11, 12, 1, 2],
            ),

            new BusinessBlueprint(
                key: 'volumen',
                name: 'Logística Interlog',
                stresses: 'VOLUMEN: 60 empleados y 12 puestos. ¿Escala?',
                employees: 60,
                positions: [
                    'Carga', 'Descarga', 'Picking', 'Packing', 'Inventario', 'Carretilla',
                    'Expediciones', 'Devoluciones', 'Calidad', 'Mantenimiento', 'Oficina', 'Seguridad',
                ],
                profiles: [
                    ['name' => 'Turno mañana', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 22]],
                    ['name' => 'Turno tarde', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 22]],
                    ['name' => 'Turno noche', 'limits' => ['max_minutes_week' => 2100, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 25]],
                ],
                coverage: [
                    ['position' => 'Picking', 'days' => [1, 2, 3, 4, 5], 'from' => '06:00', 'to' => '14:00', 'count' => 8],
                    ['position' => 'Picking', 'days' => [1, 2, 3, 4, 5], 'from' => '14:00', 'to' => '22:00', 'count' => 6],
                    ['position' => 'Packing', 'days' => [1, 2, 3, 4, 5], 'from' => '06:00', 'to' => '14:00', 'count' => 6],
                    ['position' => 'Carga', 'days' => [1, 2, 3, 4, 5], 'from' => '06:00', 'to' => '14:00', 'count' => 4],
                    ['position' => 'Expediciones', 'days' => [1, 2, 3, 4, 5], 'from' => '14:00', 'to' => '22:00', 'count' => 4],
                ],
            ),

            new BusinessBlueprint(
                key: 'overrides',
                name: 'Taller Mecánico Ruiz',
                stresses: 'CADA empleado con overrides: nadie usa el perfil puro.',
                employees: 9,
                positions: ['Chapa', 'Mecánica', 'Recambios'],
                profiles: [
                    ['name' => 'Base', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 22]],
                ],
                coverage: [
                    ['position' => 'Mecánica', 'days' => [1, 2, 3, 4, 5], 'from' => '09:00', 'to' => '13:00', 'count' => 2],
                    ['position' => 'Mecánica', 'days' => [1, 2, 3, 4, 5], 'from' => '15:00', 'to' => '19:00', 'count' => 2],
                ],
                overrideRatio: 1.0,
            ),

            new BusinessBlueprint(
                key: 'festivos',
                name: 'Museo Provincial',
                stresses: 'Festivos locales raros y cierres a mitad de semana.',
                employees: 7,
                positions: ['Sala', 'Taquilla'],
                profiles: [
                    ['name' => 'Completa', 'limits' => ['max_minutes_week' => 2100, 'annual_leave_days' => 22]],
                ],
                coverage: [
                    ['position' => 'Sala', 'days' => [2, 3, 4, 5, 6, 7], 'from' => '10:00', 'to' => '14:00', 'count' => 2],
                ],
                companyAttributes: ['non_working_weekdays' => [1]],
                holidays: ['2026-01-06', '2026-03-05', '2026-04-23', '2026-08-15', '2026-10-12', '2026-12-25'],
            ),

            new BusinessBlueprint(
                key: 'grupo_a',
                name: 'Grupo Ibérico — Cafetería',
                stresses: 'Empresario con 3 empresas y personas COMPARTIDAS entre ellas.',
                employees: 6,
                positions: ['Barra', 'Cocina'],
                profiles: [
                    ['name' => 'Completa', 'limits' => ['max_minutes_week' => 2400, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 22]],
                    ['name' => 'Parcial', 'limits' => ['max_minutes_week' => 1200, 'min_rest_minutes_between_shifts' => 720, 'annual_leave_days' => 11]],
                ],
                coverage: [
                    ['position' => 'Barra', 'days' => [1, 2, 3, 4, 5], 'from' => '08:00', 'to' => '12:00', 'count' => 2],
                ],
            ),
        ];
    }
}
