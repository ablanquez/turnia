<?php

namespace Tests\Feature\Writing;

use App\Models\Assignment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * LAS RUTAS QUE ESCRIBEN. Y las que NO.
 *
 * Aquí se prueban tres cosas que el candado por sí solo no cubre:
 *
 *   1. LAS POLICIES. Un empleado NO escribe. Un encargado escribe SOLO en su empresa. Y eso vale
 *      también para la PREVISUALIZACIÓN — que no escribe, pero DICE COSAS de la plantilla.
 *   2. LOS TRES CÓDIGOS. 200 escrito · 422 imposible · 409 hace falta que decidas.
 *   3. QUE LA PREVISUALIZACIÓN NO ESCRIBE. Nunca. Ni cuando el resultado es limpio.
 */
class AssignmentEndpointsTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    private function mundo(): array
    {
        $owner = $this->makeUser();
        $company = $this->makeCompany($owner);
        $profile = $this->makeProfile($company, ['min_rest_minutes_between_shifts' => 720]);

        $person = $this->makePerson($owner);
        $employment = $this->makeEmployment($company, $person, $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $calendar = $this->makeCalendar($company);

        return compact('owner', 'company', 'person', 'employment', 'position', 'calendar');
    }

    private function url(array $m, string $sufijo = ''): string
    {
        return "/companies/{$m['company']->id}/calendars/{$m['calendar']->id}/assignments{$sufijo}";
    }

    private function cuerpo(array $m, array $extra = []): array
    {
        return array_merge([
            'employmentId' => $m['employment']->id,
            'positionId' => $m['position']->id,
            'workDate' => '2026-07-13',
            'start' => '12:00',
            'end' => '20:00',
        ], $extra);
    }

    /* ── LO QUE SE ESCRIBE ─────────────────────────────────────────────────────── */

    #[Test]
    public function el_encargado_coloca_un_turno_limpio(): void
    {
        $m = $this->mundo();

        $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m))
            ->assertOk()
            ->assertJson(['resultado' => 'escrito', 'forzado' => false]);

        $this->assertDatabaseCount('assignments', 1);
    }

    #[Test]
    public function un_imposible_devuelve_422_y_no_escribe(): void
    {
        $m = $this->mundo();

        $this->assign($m['employment'], $m['position'], '2026-07-13', '10:00', '18:00', calendar: $m['calendar']);

        $r = $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m, ['start' => '14:00', 'end' => '20:00']))
            ->assertStatus(422)
            ->assertJson(['resultado' => 'imposible']);

        // ⚠️ Y DICE POR QUÉ. Un "no puedo" sin motivo es un muro.
        $this->assertSame('overlap', $r->json('violations.0.code'));
        $this->assertDatabaseCount('assignments', 1);
    }

    #[Test]
    public function un_incumplimiento_devuelve_409_y_pregunta_antes_de_escribir(): void
    {
        $m = $this->mundo();

        $this->assign($m['employment'], $m['position'], '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $m['calendar']);

        $r = $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m, ['start' => '08:00', 'end' => '16:00']))
            ->assertStatus(409)
            ->assertJson(['resultado' => 'necesita_decision']);

        $this->assertSame('minimum_rest', $r->json('violations.0.code'));
        $this->assertDatabaseCount('assignments', 1);   // NO se ha escrito
    }

    #[Test]
    public function forzando_se_escribe_y_queda_constancia(): void
    {
        $m = $this->mundo();

        $this->assign($m['employment'], $m['position'], '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $m['calendar']);

        $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m, [
                'start' => '08:00',
                'end' => '16:00',
                'force' => ['reason' => 'Cubre el cierre de anoche.', 'codes' => ['minimum_rest']],
            ]))
            ->assertOk()
            ->assertJson(['resultado' => 'escrito', 'forzado' => true]);

        $this->assertDatabaseHas('assignment_overrides', [
            'user_id' => $m['owner']->id,
            'reason' => 'Cubre el cierre de anoche.',
        ]);
    }

    /** ⚠️ No se puede forzar sin decir por qué. Es el único dato que la app no deduce sola. */
    #[Test]
    public function no_se_puede_forzar_sin_justificacion(): void
    {
        $m = $this->mundo();

        $this->assign($m['employment'], $m['position'], '2026-07-12', '16:00', '00:00', endDate: '2026-07-13', calendar: $m['calendar']);

        $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m, [
                'start' => '08:00',
                'end' => '16:00',
                'force' => ['codes' => ['minimum_rest']],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('force.reason');

        $this->assertDatabaseCount('assignment_overrides', 0);
    }

    #[Test]
    public function mover_y_quitar(): void
    {
        $m = $this->mundo();

        $a = $this->assign($m['employment'], $m['position'], '2026-07-13', '12:00', '20:00', calendar: $m['calendar']);

        $this->actingAs($m['owner'])
            ->patchJson($this->url($m, "/{$a->id}"), $this->cuerpo($m, ['workDate' => '2026-07-15']))
            ->assertOk()
            ->assertJson(['resultado' => 'escrito']);

        $this->assertSame('2026-07-15', $a->fresh()->work_date->toDateString());

        $this->actingAs($m['owner'])
            ->deleteJson($this->url($m, "/{$a->id}"))
            ->assertOk()
            ->assertJson(['resultado' => 'quitado']);

        $this->assertSame(0, Assignment::count());
    }

    /* ── LA PREVISUALIZACIÓN. NO ESCRIBE. NUNCA. ───────────────────────────────── */

    #[Test]
    public function la_previsualizacion_valida_y_no_escribe_nada(): void
    {
        $m = $this->mundo();

        $r = $this->actingAs($m['owner'])
            ->postJson($this->url($m, '/preview'), $this->cuerpo($m))
            ->assertOk();

        $this->assertTrue($r->json('esUnaPrevisualizacion'));
        $this->assertNull($r->json('severidad'));

        // ⚠️ EL RESULTADO ERA LIMPIO. Y AUN ASÍ NO HA ESCRITO NADA.
        $this->assertDatabaseCount('assignments', 0);
    }

    #[Test]
    public function la_previsualizacion_dice_la_gravedad(): void
    {
        $m = $this->mundo();

        $this->assign($m['employment'], $m['position'], '2026-07-13', '10:00', '18:00', calendar: $m['calendar']);

        $r = $this->actingAs($m['owner'])
            ->postJson($this->url($m, '/preview'), $this->cuerpo($m, ['start' => '14:00', 'end' => '20:00']))
            ->assertOk();

        $this->assertSame('impossible', $r->json('severidad'));
        $this->assertDatabaseCount('assignments', 1);   // sigue sin escribir
    }

    /* ── LAS POLICIES ──────────────────────────────────────────────────────────── */

    #[Test]
    public function un_empleado_no_escribe(): void
    {
        $m = $this->mundo();

        // Un usuario que TRABAJA en la empresa, pero no la gestiona.
        $empleado = $this->makeUser();
        $empleado->person_id = $m['person']->id;
        $empleado->save();

        $this->actingAs($empleado)->postJson($this->url($m), $this->cuerpo($m))->assertForbidden();
        $this->assertDatabaseCount('assignments', 0);
    }

    /**
     * ⚠️ Y TAMPOCO PUEDE PREVISUALIZAR.
     *
     * La previsualización no escribe, pero DICE COSAS: «ya tiene un turno de 22:00 a 06:00 en el
     * Bar Central». Eso es información de la plantilla. Un endpoint de solo lectura que filtra
     * datos es una fuga, no una lectura inofensiva.
     */
    #[Test]
    public function un_empleado_tampoco_previsualiza(): void
    {
        $m = $this->mundo();

        $empleado = $this->makeUser();
        $empleado->person_id = $m['person']->id;
        $empleado->save();

        $this->actingAs($empleado)->postJson($this->url($m, '/preview'), $this->cuerpo($m))->assertForbidden();
    }

    #[Test]
    public function un_encargado_no_escribe_en_otra_empresa(): void
    {
        $m = $this->mundo();

        // El dueño de OTRO bar, con su propia empresa. Nada que hacer aquí.
        $otro = $this->makeUser();
        $this->makeCompany($otro);

        $this->actingAs($otro)->postJson($this->url($m), $this->cuerpo($m))->assertForbidden();
        $this->assertDatabaseCount('assignments', 0);
    }

    /**
     * ⚠️ UN PUESTO DE OTRA EMPRESA NO SE COLOCA, AUNQUE EL ID EXISTA.
     *
     * El motor validaría tan contento: el puesto existe. Pero el turno acabaría en el puesto de
     * otro bar, y ese bar no se enteraría. La comprobación va en la petición, no en el motor: es
     * una cuestión de PERTENENCIA, no de convenio.
     */
    #[Test]
    public function no_se_puede_colocar_en_un_puesto_de_otra_empresa(): void
    {
        $m = $this->mundo();

        $ajeno = $this->makePosition($this->makeCompany($this->makeUser()), 'Barra ajena');

        $this->actingAs($m['owner'])
            ->postJson($this->url($m), $this->cuerpo($m, ['positionId' => $ajeno->id]))
            ->assertNotFound();

        $this->assertDatabaseCount('assignments', 0);
    }
}
