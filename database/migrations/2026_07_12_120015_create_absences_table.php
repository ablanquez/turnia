<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Bloquea días enteros. Granularidad: RANGO DE DÍAS.
     */
    public function up(): void
    {
        Schema::create('absences', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();

            $table->foreignId('company_id')->constrained()->cascadeOnDelete();

            // La ausencia cuelga de la PERSONA...
            $table->foreignId('person_id')->constrained()->cascadeOnDelete();

            // ...y employment_id NULL significa que afecta a TODOS sus contratos.
            // Una baja es de la persona; unas vacaciones, de un contrato concreto.
            $table->foreignId('employment_id')->nullable()->constrained()->cascadeOnDelete();

            $table->foreignId('absence_type_id')->constrained()->cascadeOnDelete();

            $table->date('starts_on');

            // NULL = baja abierta, de duración indefinida al inicio.
            // No hay que inventar una fecha de fin falsa.
            $table->date('ends_on')->nullable();

            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // "¿Está esta persona de baja el día X?" y detección de asignaciones
            // huérfanas. Por persona, no por contrato: una baja bloquea los dos bares.
            $table->index(['person_id', 'starts_on', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absences');
    }
};
