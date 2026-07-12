<?php

namespace Tests\Feature\Stress;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Enums\Severity;
use App\Enums\WorkdayType;
use App\Providers\AppServiceProvider;
use App\Services\Scheduling\Validation\AssignmentValidator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * BLOQUE 3: qué pasa cuando VARIAS reglas saltan a la vez.
 *
 * Todo se probó regla a regla. Nadie probó la orquesta.
 */
class RuleInteractionTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    /** Un escenario donde saltan las tres gravedades a la vez. */
    private function tormentaPerfecta(): array
    {
        $user = $this->makeUser();
        $maria = $this->makePerson($user);

        $barA = $this->makeCompany($user, ['name' => 'Bar A']);
        $barB = $this->makeCompany($user, ['name' => 'Bar B']);

        // Perfil apretado: continua, 8h semanales, 12h de descanso.
        $perfilB = $this->makeProfile($barB, [
            'max_minutes_week' => 480,
            'min_rest_minutes_between_shifts' => 720,
            'workday_type' => WorkdayType::Continuous,
        ]);

        $enA = $this->makeEmployment($barA, $maria);
        $enB = $this->makeEmployment($barB, $maria, $perfilB);

        $barraA = $this->makePosition($barA, 'Barra A');
        $cocinaB = $this->makePosition($barB, 'Cocina B');
        // NO se le adjunta cocinaB: no está cualificada (Breach).

        // Turno en el Bar A que acaba a las 02:00 (rompe el descanso de lo que venga).
        $this->assign($enA, $barraA, '2026-07-15', '18:00', '02:00', endDate: '2026-07-16');

        // Y otro en el Bar A el día 16 de madrugada: ese día trabaja en las DOS empresas
        // (dispara el aviso informativo del día compartido).
        $this->assign($enA, $barraA, '2026-07-16', '06:00', '08:00');

        // Y ya tiene un turno en el Bar B ese mismo día 16 (partida + tope + solape).
        $this->assign($enB, $cocinaB, '2026-07-16', '09:00', '17:00');

        // Baja abierta desde el 16 (Impossible).
        $baja = $this->makeAbsenceType($barA, AbsenceScope::Person, Computation::Blocks, 'Baja');
        $this->addAbsence($maria, $baja, '2026-07-16', endsOn: null);

        return compact('user', 'maria', 'barA', 'barB', 'enA', 'enB', 'barraA', 'cocinaB');
    }

    #[Test]
    public function las_tres_gravedades_se_reportan_a_la_vez_sin_que_una_eclipse_a_las_otras(): void
    {
        ['enB' => $enB, 'cocinaB' => $cocinaB] = $this->tormentaPerfecta();

        // Se intenta colocar OTRO turno el 16 en el Bar B, solapando con el que ya hay.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB, $cocinaB, '2026-07-16', '10:00', '18:00')
        );

        // DECISIÓN: el motor NO corta al primer imposible. Reporta TODO lo que sabe.
        //
        // Justificación: si el imposible eclipsara al resto, el encargado arreglaría el
        // solape, volvería a intentarlo y descubriría el siguiente problema. Y otra vez.
        // Un diagnóstico a plazos entrena a odiar la herramienta. Además, la capa que
        // escribe puede querer bloquear por el imposible Y registrar el incumplimiento
        // en el mismo gesto.
        $this->assertGreaterThanOrEqual(1, $result->impossibles()->count());
        $this->assertGreaterThanOrEqual(1, $result->breaches()->count());
        $this->assertGreaterThanOrEqual(1, $result->notices()->count());

        // Impossible: solapa y está de baja.
        $this->assertTrue($result->has(RuleCode::Overlap));
        $this->assertTrue($result->has(RuleCode::Unavailable));

        // Breach: no cualificada, se pasa de horas, rompe descanso, y su perfil es continuo.
        $this->assertTrue($result->has(RuleCode::Eligibility));
        $this->assertTrue($result->has(RuleCode::HourLimit));
        $this->assertTrue($result->has(RuleCode::WorkdayType));

        // Notice: ese día también trabaja en otra empresa.
        $this->assertTrue($result->has(RuleCode::SharedWorkday));

        $this->assertFalse($result->isPossible());
    }

    #[Test]
    public function el_resultado_es_identico_ejecutando_las_reglas_en_orden_aleatorio_100_veces(): void
    {
        // Si alguna regla dependiera del orden, habría acoplamiento oculto: una regla
        // estaría leyendo un estado que otra dejó. Como ninguna escribe, no debería
        // pasar. Pero "no debería" no es una demostración.
        ['enB' => $enB, 'cocinaB' => $cocinaB] = $this->tormentaPerfecta();

        $draft = $this->draft($enB, $cocinaB, '2026-07-16', '10:00', '18:00');

        $rules = AppServiceProvider::ASSIGNMENT_RULES;

        $referencia = null;

        for ($i = 0; $i < 100; $i++) {
            shuffle($rules);

            $validator = new AssignmentValidator(
                array_map(fn (string $rule) => app($rule), $rules)
            );

            // Se compara el CONJUNTO de violaciones, no su orden de llegada: el orden en
            // que se pinten es cosa de la interfaz.
            $huella = $validator->validate($draft)->violations
                ->map(fn ($v) => $v->code->value.':'.$v->severity->value.':'.json_encode($v->context))
                ->sort()
                ->values()
                ->all();

            $referencia ??= $huella;

            $this->assertSame(
                $referencia,
                $huella,
                "El resultado cambia según el orden de las reglas (iteración {$i}): hay acoplamiento oculto.",
            );
        }

        $this->assertNotEmpty($referencia);
    }

    #[Test]
    public function ninguna_regla_contradice_a_otra_sobre_el_mismo_hecho(): void
    {
        // Dos reglas se contradirían si una dijera "esto es imposible" y otra "esto está
        // perfecto" sobre EL MISMO hecho. Estructuralmente no puede pasar: una regla solo
        // añade violaciones, ninguna las quita ni vota "correcto".
        //
        // El caso que SÍ podría parecer contradicción: la jornada partida.
        // - WorkdayTypeRule dice: "tu perfil solo admite continua" (Breach).
        // - MinimumRestRule NO dice nada, porque el descanso es entre jornadas.
        // No se contradicen: hablan de cosas distintas. Y esta es la prueba.
        $user = $this->makeUser();
        $company = $this->makeCompany($user);
        $profile = $this->makeProfile($company, [
            'workday_type' => WorkdayType::Continuous,
            'min_rest_minutes_between_shifts' => 720,
        ]);
        $employment = $this->makeEmployment($company, $this->makePerson($user), $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-15', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-15', '17:00', '21:00')
        );

        $this->assertTrue($result->has(RuleCode::WorkdayType), 'El perfil continuo debe quejarse.');
        $this->assertFalse($result->has(RuleCode::MinimumRest), 'Pero el descanso NO, o sería la contradicción.');
    }

    #[Test]
    public function un_limpio_es_limpio_de_verdad_y_todas_las_reglas_han_corrido(): void
    {
        // ¿El "limpio" es limpio, o es que alguna regla se ha caído de la lista y nadie
        // se ha enterado? Si mañana alguien borra una regla del AppServiceProvider, todo
        // seguiría en verde y el motor validaría MENOS en silencio.
        $this->assertCount(
            10,
            AppServiceProvider::ASSIGNMENT_RULES,
            'Ha cambiado el número de reglas de asignación: revisa que no se haya perdido ninguna.',
        );
        $this->assertCount(5, AppServiceProvider::CONCEPT_RULES);
        $this->assertCount(5, AppServiceProvider::ABSENCE_RULES);

        // Y ninguna clase de regla puede estar registrada dos veces: se duplicarían los
        // avisos y el encargado vería el mismo problema por partida doble.
        $this->assertSame(
            AppServiceProvider::ASSIGNMENT_RULES,
            array_values(array_unique(AppServiceProvider::ASSIGNMENT_RULES)),
        );
    }

    #[Test]
    public function el_imposible_y_el_incumplimiento_conviven_sin_pisarse(): void
    {
        ['enB' => $enB, 'cocinaB' => $cocinaB] = $this->tormentaPerfecta();

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enB, $cocinaB, '2026-07-16', '10:00', '18:00')
        );

        // Cada violación tiene UNA gravedad, y las tres colecciones no se solapan.
        $total = $result->impossibles()->count()
            + $result->breaches()->count()
            + $result->notices()->count();

        $this->assertSame($result->violations->count(), $total, 'Hay violaciones sin gravedad o contadas dos veces.');

        foreach ($result->violations as $violation) {
            $this->assertContains($violation->severity, [Severity::Impossible, Severity::Breach, Severity::Notice]);
        }
    }
}
