<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Catálogo de conceptos horarios (granularidad: FRANJA).
     *
     * Turnia no sabe qué es una hora médica. Sabe que hay un concepto cuyo
     * campo `computation` dice cómo computa. El catálogo lo crea la empresa.
     */
    public function up(): void
    {
        Schema::create('concept_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('computation');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('concept_types');
    }
};
