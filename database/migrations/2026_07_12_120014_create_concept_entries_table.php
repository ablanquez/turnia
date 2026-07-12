<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Ocupa horas pero NO cubre puesto. Granularidad: FRANJA HORARIA.
     *
     * Idéntica a assignments menos position_id y calendar_id: esa ausencia de
     * columnas ES la diferencia semántica.
     */
    public function up(): void
    {
        Schema::create('concept_entries', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('concept_type_id')->constrained()->cascadeOnDelete();

            // Denormalizado por el mismo motivo que en assignments: un concepto
            // ocupa tiempo, así que entra en la validación de solape por persona.
            $table->foreignId('person_id')->constrained()->cascadeOnDelete();

            $table->date('work_date');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // El contador de horas: la otra mitad de la suma.
            $table->index(['employment_id', 'work_date']);
            $table->index(['person_id', 'starts_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_entries');
    }
};
