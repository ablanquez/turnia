<?php

use App\Enums\AbsenceScope;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de ausencias (granularidad: RANGO DE DÍAS).
     */
    public function up(): void
    {
        Schema::create('absence_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('computation');

            // A quién afecta: una baja es de la persona (bloquea todos sus
            // contratos); unas vacaciones son de un contrato concreto.
            $table->string('scope')->default(AbsenceScope::Employment->value);

            // Qué ausencias descuentan del cupo de vacaciones del perfil.
            // Sigue siendo un parámetro: el motor no sabe qué son "las vacaciones",
            // sabe que hay tipos que consumen cupo y otros que no.
            $table->boolean('consumes_leave_quota')->default(false);

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('absence_types');
    }
};
