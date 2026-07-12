<?php

namespace Tests\Feature\Stress;

use App\Models\Assignment;
use App\Services\Scheduling\Validation\AssignmentDraft;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\StressWorld;
use Tests\TestCase;

/**
 * LA PRUEBA QUE NADIE HABÍA HECHO.
 *
 * Si el motor dijo "LIMPIO" al colocar cada asignación una por una, ¿el conjunto
 * resultante SIGUE limpio al re-validarlo entero?
 *
 * Si no, es un SILENCIO FALSO de manual: el encargado monta la semana sin un solo
 * aviso y le sale un cuadrante ilegal.
 */
class GlobalCoherenceTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function el_conjunto_sigue_limpio_despues_de_colocarlo_pieza_a_pieza(): void
    {
        $from = CarbonImmutable::parse('2026-03-02'); // lunes
        $to = CarbonImmutable::parse('2026-03-31');

        $world = (new StressWorld(app(AssignmentValidator::class)))->build($from, $to);

        $this->assertGreaterThan(1000, $world->placed, 'El escenario es demasiado blando: casi no se colocó nada.');

        $validator = app(AssignmentValidator::class);
        $sucias = [];

        Assignment::with(['employment.profile', 'employment.company', 'position'])
            ->chunkById(500, function ($assignments) use ($validator, &$sucias) {
                foreach ($assignments as $assignment) {
                    $result = $validator->validate(AssignmentDraft::fromAssignment($assignment));

                    if (! $result->isClean()) {
                        $sucias[] = sprintf(
                            '#%d %s %s (%s): %s',
                            $assignment->id,
                            $assignment->work_date->toDateString(),
                            $assignment->position->name,
                            $assignment->employment->company->name,
                            $result->violations->map(fn ($v) => $v->code->value)->unique()->join(', '),
                        );
                    }
                }
            });

        $this->assertSame(
            [],
            array_slice($sucias, 0, 20),
            sprintf(
                "COHERENCIA ROTA: %d de %d asignaciones se colocaron LIMPIAS y ahora incumplen.\n".
                "Colocar A es válido, colocar B es válido, pero A+B no. Eso es un silencio falso.\n",
                count($sucias),
                $world->placed,
            ),
        );
    }
}
