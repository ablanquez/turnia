<?php

namespace Tests\Feature\Scheduling;

use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Enums\WorkdayType;
use App\Services\Scheduling\Validation\AssignmentValidator;
use App\Services\Scheduling\Validation\ConceptEntryValidator;
use App\Services\Scheduling\Validation\Violation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use PHPUnit\Framework\Attributes\Test;
use Tests\Concerns\BuildsSchedulingWorld;
use Tests\TestCase;

/**
 * EL MENSAJE TAMBIÉN TIENE QUE DECIR LA VERDAD.
 *
 * ⚠️ ESTE FICHERO EXISTE POR UN AGUJERO EN LA ESTRATEGIA DE PRUEBAS, NO POR UN BUG.
 *
 * Durante cuatro tandas, los tests del motor comprobaron que la regla SALTABA: que el
 * RuleCode correcto aparecía en el resultado. Ninguno leyó nunca el TEXTO. Y el texto
 * mentía: los turnos se guardan en UTC, y cuatro reglas escribían la hora con
 * ->format('H:i') sobre el instante crudo. En Madrid en verano eso son DOS HORAS MENOS.
 *
 * El motor decía "ya tiene un turno de 12:00 a 18:00" cuando el turno era de 14:00 a
 * 20:00. El aviso era correcto y la hora, falsa. El encargado mira las 12:00 de su
 * parrilla, no encuentra nada, y deja de creerse los avisos.
 *
 * UN AVISO QUE MIENTE EN LOS DETALLES HACE MÁS DAÑO QUE NINGÚN AVISO.
 *
 * Probar que la regla salta no basta. Si un mensaje puede mentir, hay que probar el
 * mensaje.
 */
class MessageTruthTest extends TestCase
{
    use BuildsSchedulingWorld;
    use RefreshDatabase;

    #[Test]
    public function el_mensaje_del_solape_da_la_hora_local_de_la_empresa_no_la_utc(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        // Julio: Madrid va en UTC+2. Este turno se guarda como 12:00-18:00 UTC.
        $existente = $this->assign($employment, $position, '2026-07-06', '14:00', '20:00');
        $this->assertSame('12:00', $existente->starts_at->format('H:i'), 'En la base está en UTC.');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-06', '16:00', '22:00')
        );

        $mensaje = $this->messageOf($result->violations, RuleCode::Overlap);

        // LA HORA DEL MENSAJE ES LA DEL RELOJ DEL BAR, que es la que el encargado busca
        // en su parrilla.
        $this->assertStringContainsString('de 14:00 a 20:00', $mensaje);
        $this->assertStringNotContainsString('12:00', $mensaje, 'Estaría dando la hora UTC.');
    }

    #[Test]
    public function en_invierno_el_mensaje_tambien_dice_la_verdad(): void
    {
        // El desfase cambia con la estación: en enero Madrid va en UTC+1, no en UTC+2.
        // Un arreglo que restara "dos horas" a mano habría pasado el test de julio y
        // habría fallado aquí. Por eso hay dos.
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $existente = $this->assign($employment, $position, '2026-01-12', '14:00', '20:00');
        $this->assertSame('13:00', $existente->starts_at->format('H:i'), 'En enero, UTC+1.');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-01-12', '16:00', '22:00')
        );

        $this->assertStringContainsString(
            'de 14:00 a 20:00',
            $this->messageOf($result->violations, RuleCode::Overlap),
        );
    }

    #[Test]
    public function el_turno_de_otra_empresa_se_nombra_con_la_hora_de_esa_empresa(): void
    {
        /*
         * EL CASO QUE MÁS FÁCIL SE ESCAPA.
         *
         * María trabaja en un bar de Madrid y en otro de Canarias, que va una hora por
         * detrás. Los dos turnos ocupan EL MISMO INSTANTE, y sin embargo cada uno se
         * llama de otra manera en su casa.
         *
         * El mensaje tiene que dar la hora de LA EMPRESA DONDE OCURRE EL TURNO, no la de
         * la empresa desde la que se mira. Usar la del que mira sería mentir con
         * precisión: una hora concreta, verosímil, y equivocada.
         */
        $user = $this->makeUser();
        $madrid = $this->makeCompany($user, ['timezone' => 'Europe/Madrid', 'name' => 'Bar Madrid']);
        $canarias = $this->makeCompany($user, ['timezone' => 'Atlantic/Canary', 'name' => 'Bar Canarias']);

        $person = $this->makePerson($user);

        $enCanarias = $this->makeEmployment($canarias, $person);
        $puestoCanario = $this->makePosition($canarias);
        $enCanarias->positions()->attach($puestoCanario);

        // 11:00-17:00 en Canarias (UTC+1 en julio) = 10:00-16:00 UTC.
        $turnoCanario = $this->assign($enCanarias, $puestoCanario, '2026-07-06', '11:00', '17:00');
        $this->assertSame('10:00', $turnoCanario->starts_at->format('H:i'));

        $enMadrid = $this->makeEmployment($madrid, $person);
        $puestoMadrileno = $this->makePosition($madrid);
        $enMadrid->positions()->attach($puestoMadrileno);

        // 12:00-18:00 en Madrid (UTC+2) = 10:00-16:00 UTC: el MISMO instante. Solapan.
        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enMadrid, $puestoMadrileno, '2026-07-06', '12:00', '18:00')
        );

        $mensaje = $this->messageOf($result->violations, RuleCode::Overlap);

        $this->assertStringContainsString('Bar Canarias', $mensaje);
        $this->assertStringContainsString(
            'de 11:00 a 17:00',
            $mensaje,
            'La hora del turno canario, en el reloj de Canarias. Ni la de Madrid ni la UTC.',
        );
        $this->assertStringNotContainsString('12:00', $mensaje, 'Sería la hora de quien mira.');
        $this->assertStringNotContainsString('10:00', $mensaje, 'Sería la hora UTC.');
    }

    #[Test]
    public function el_mensaje_del_concepto_horario_da_la_hora_local(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');
        $this->addConcept($employment, $medica, '2026-07-06', '10:00', '11:30');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-06', '09:00', '17:00')
        );

        $this->assertStringContainsString(
            'de 10:00 a 11:30',
            $this->messageOf($result->violations, RuleCode::Overlap),
        );
    }

    #[Test]
    public function el_mensaje_del_turno_que_pisa_un_concepto_da_la_hora_local(): void
    {
        // La dirección contraria: se registra un concepto encima de un turno.
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-06', '09:00', '17:00');

        $medica = $this->makeConceptType($company, Computation::Adds, 'Hora médica');

        $result = app(ConceptEntryValidator::class)->validate(
            $this->conceptDraft($employment, $medica, '2026-07-06', '10:00', '11:30')
        );

        $this->assertStringContainsString(
            'de 09:00 a 17:00',
            $this->messageOf($result->violations, RuleCode::Overlap),
        );
    }

    #[Test]
    public function el_mensaje_de_la_jornada_continua_da_la_hora_local(): void
    {
        $user = $this->makeUser();
        $company = $this->makeCompany($user, ['timezone' => 'Europe/Madrid']);
        $profile = $this->makeProfile($company, ['workday_type' => WorkdayType::Continuous]);
        $person = $this->makePerson($user);
        $employment = $this->makeEmployment($company, $person, $profile);
        $position = $this->makePosition($company);
        $employment->positions()->attach($position);

        $this->assign($employment, $position, '2026-07-06', '09:00', '13:00');

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($employment, $position, '2026-07-06', '17:00', '21:00')
        );

        $this->assertStringContainsString(
            '(09:00 a 13:00)',
            $this->messageOf($result->violations, RuleCode::WorkdayType),
        );
    }

    #[Test]
    public function el_mensaje_de_jornada_compartida_da_la_hora_del_otro_bar(): void
    {
        $user = $this->makeUser();
        $optim = $this->makeCompany($user, ['timezone' => 'Europe/Madrid', 'name' => "L'Òptim"]);
        $central = $this->makeCompany($user, ['timezone' => 'Europe/Madrid', 'name' => 'Bar Central']);

        $person = $this->makePerson($user);

        $enCentral = $this->makeEmployment($central, $person);
        $puestoCentral = $this->makePosition($central);
        $enCentral->positions()->attach($puestoCentral);
        $this->assign($enCentral, $puestoCentral, '2026-07-06', '08:00', '12:00');

        $enOptim = $this->makeEmployment($optim, $person);
        $puestoOptim = $this->makePosition($optim);
        $enOptim->positions()->attach($puestoOptim);

        $result = app(AssignmentValidator::class)->validate(
            $this->draft($enOptim, $puestoOptim, '2026-07-06', '16:00', '20:00')
        );

        $mensaje = $this->messageOf($result->violations, RuleCode::SharedWorkday);

        $this->assertStringContainsString('Bar Central', $mensaje);
        $this->assertStringContainsString('08:00-12:00', $mensaje);
        $this->assertStringNotContainsString('06:00', $mensaje, 'Sería la hora UTC.');
    }

    /** @param  Collection<int, Violation>  $violations */
    private function messageOf($violations, RuleCode $code): string
    {
        $violation = $violations->first(fn (Violation $v) => $v->code === $code);

        $this->assertNotNull($violation, "No saltó la regla {$code->value}.");

        return $violation->message;
    }
}
