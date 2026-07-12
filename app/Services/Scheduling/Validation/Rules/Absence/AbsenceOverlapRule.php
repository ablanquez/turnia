<?php

namespace App\Services\Scheduling\Validation\Rules\Absence;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use App\Enums\RuleCode;
use App\Models\Absence;
use App\Services\Scheduling\LeaveQuota;
use App\Services\Scheduling\Validation\AbsenceDraft;
use App\Services\Scheduling\Validation\AbsenceRule;
use App\Services\Scheduling\Validation\Violation;
use App\Support\TimeWindow;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Dos ausencias solapadas.
 *
 * INCUMPLIMIENTO, no imposible, y es una decisión deliberada: en España, si te pones
 * enfermo durante las vacaciones, la baja INTERRUMPE las vacaciones y esos días se
 * recuperan. Es un caso real y frecuente. Si el motor lo marcara como imposible, el
 * gestor borraría las vacaciones a mano para poder registrar la baja — y ahí está el
 * dato corrupto que queríamos evitar. La app forzaría el error que pretende impedir.
 *
 * Lo único IMPOSIBLE es el duplicado del MISMO tipo: dos bajas solapadas, o dos
 * vacaciones solapadas, no significan nada.
 *
 * Y cuando una ausencia que bloquea pisa otra que consume cupo, se avisa de cuántos
 * días laborables quedan pisados. NO se devuelven al cupo automáticamente: eso es una
 * decisión laboral del empresario, y Turnia informa, no decide.
 */
class AbsenceOverlapRule implements AbsenceRule
{
    public function __construct(private LeaveQuota $quota) {}

    public function check(AbsenceDraft $draft): array
    {
        if (! $draft->isOpenEnded() && $draft->endsOn->lt($draft->startsOn)) {
            return []; // Rango corrupto: lo caza DateRangeSanityRule.
        }

        $violations = [];

        foreach ($this->overlapping($draft) as $other) {
            $violations[] = $other->absence_type_id === $draft->absenceType->id
                ? Violation::impossible(
                    RuleCode::DuplicateAbsence,
                    sprintf('Ya tiene otra ausencia de "%s" en esas fechas.', $draft->absenceType->name),
                    ['absence_id' => $other->id],
                )
                : Violation::breach(
                    RuleCode::AbsenceOverlap,
                    sprintf(
                        'Se solapa con "%s" (desde el %s).',
                        $other->absenceType->name,
                        $other->starts_on->format('d/m/Y'),
                    ),
                    ['absence_id' => $other->id, 'absence_type' => $other->absenceType->name],
                );

            $violations = array_merge($violations, $this->leaveInterruptionNotice($draft, $other));
        }

        return $violations;
    }

    /**
     * Las ausencias de la persona que alcanzan al mismo contrato y solapan en fechas.
     *
     * Una ausencia de alcance PERSONA alcanza a todos los contratos, así que choca
     * con cualquier otra. Una de contrato solo choca con las de su contrato (y con
     * las de persona).
     */
    private function overlapping(AbsenceDraft $draft)
    {
        return Absence::query()
            ->where('person_id', $draft->person->id)
            ->when($draft->ignoreAbsenceId, fn (Builder $q, $id) => $q->whereKeyNot($id))
            ->where('starts_on', '<=', $draft->endsOn?->toDateString() ?? '9999-12-31')
            ->where(fn (Builder $q) => $q
                ->whereNull('ends_on') // abierta: solapa con todo lo que venga después
                ->orWhere('ends_on', '>=', $draft->startsOn->toDateString()))
            ->when(
                $draft->scope() === AbsenceScope::Employment,
                fn (Builder $q) => $q->where(fn (Builder $inner) => $inner
                    ->where('employment_id', $draft->employment?->id)
                    ->orWhereHas('absenceType', fn (Builder $t) => $t->where('scope', AbsenceScope::Person))),
            )
            ->with(['absenceType', 'employment'])
            ->get();
    }

    /**
     * "Esta baja pisa 4 días de vacaciones; revisa si hay que devolverlos al cupo."
     *
     * Informativo. Devolverlos automáticamente sería que la app tomara una decisión
     * laboral por el empresario.
     */
    private function leaveInterruptionNotice(AbsenceDraft $draft, Absence $other): array
    {
        $blocks = $draft->absenceType->computation === Computation::Blocks;
        $consumes = $other->absenceType->consumes_leave_quota;

        if (! $blocks || ! $consumes || $other->employment === null || $other->ends_on === null) {
            return [];
        }

        $from = $draft->startsOn->max(CarbonImmutable::parse($other->starts_on));
        $to = ($draft->endsOn ?? CarbonImmutable::parse($other->ends_on))
            ->min(CarbonImmutable::parse($other->ends_on));

        $days = $this->quota->daysConsumedWithin(
            $other->employment,
            $from,
            $to,
            new TimeWindow($from, $to),
        );

        if ($days === 0) {
            return [];
        }

        return [Violation::notice(
            RuleCode::LeaveOverlappedByBlocking,
            sprintf(
                'Esta ausencia pisa %d día(s) laborable(s) de "%s". Revisa si hay que devolverlos al cupo.',
                $days,
                $other->absenceType->name,
            ),
            [
                'absence_id' => $other->id,
                'overlapped_working_days' => $days,
                'employment_id' => $other->employment_id,
            ],
        )];
    }
}
