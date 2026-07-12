<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Qué puestos hacen falta, en qué franja y cuántos.
     *
     * La necesidad es TEMPORAL, no estructural: el bar necesita 3 de barra en
     * agosto y 1 en febrero. Eso son dos filas con distinta vigencia.
     */
    public function up(): void
    {
        Schema::create('coverage_requirements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('calendar_id')->constrained()->cascadeOnDelete();
            $table->foreignId('position_id')->constrained()->cascadeOnDelete();

            // Ventana de vigencia: "agosto".
            $table->date('effective_from');
            $table->date('effective_to')->nullable();

            // Granularidad variable dentro de esa ventana.
            $table->string('recurrence');
            $table->unsignedTinyInteger('day_of_week')->nullable();
            $table->date('on_date')->nullable();

            // La franja.
            $table->time('starts_at');
            $table->time('ends_at');

            $table->unsignedTinyInteger('required_count');

            $table->timestamps();

            // "¿Qué necesidad está vigente en esta fecha?"
            //
            // Nombre explícito: el que Laravel autogeneraría
            // (coverage_requirements_calendar_id_effective_from_effective_to_index)
            // pasa de los 64 caracteres que admite MySQL como identificador.
            $table->index(
                ['calendar_id', 'effective_from', 'effective_to'],
                'coverage_reqs_calendar_effective_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('coverage_requirements');
    }
};
