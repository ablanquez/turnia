<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El empleado está cubriendo un puesto. Granularidad: FRANJA HORARIA.
     *
     * Junto con concept_entries, es la ÚNICA FUENTE DE VERDAD de las horas.
     * No existe ningún contador acumulado en ninguna parte.
     */
    public function up(): void
    {
        Schema::create('assignments', function (Blueprint $table) {
            $table->id();

            // Identificador estable e independiente del id autoincremental.
            // Permite que un evento exportado (iCalendar, Google Calendar) se
            // ACTUALICE en vez de duplicarse cuando se modifica el turno.
            $table->uuid('uuid')->unique();

            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('calendar_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('position_id')->constrained()->cascadeOnDelete();

            // Denormalizado desde employments. El solape y el descanso mínimo se
            // validan a nivel de PERSONA (María no puede estar en dos bares a la
            // vez, ni descansa el doble por tener dos contratos), y es la consulta
            // más caliente del sistema: no puede pagar un join.
            $table->foreignId('person_id')->constrained()->cascadeOnDelete();

            // Día al que se IMPUTA el turno. No es derivable cuando el turno cruza
            // medianoche (22:00-06:00): es una decisión de negocio.
            $table->date('work_date');

            // Datetime completos, no time: con `time` puros un turno nocturno tiene
            // ends_at < starts_at y toda consulta de duración, solape y descanso
            // necesitaría un caso especial. Así, la duración es una resta.
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // El contador de horas: la consulta más caliente.
            $table->index(['employment_id', 'work_date']);

            // Solape y descanso entre turnos, cruzando empresas.
            $table->index(['person_id', 'starts_at']);

            // Pintar la parrilla.
            $table->index(['company_id', 'work_date']);

            // Cobertura real contra coverage_requirements.
            $table->index(['calendar_id', 'work_date', 'position_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignments');
    }
};
