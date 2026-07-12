<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Los ENCARGADOS de cada empresa.
 *
 * NO lleva columna `role`, y es deliberado. El dueño ya vive en
 * companies.user_id, que es la única verdad sobre la propiedad. Meter aquí un
 * role='owner' crearía una SEGUNDA fuente de verdad sobre lo mismo, y una copia
 * que puede desincronizarse de la original es una copia que va a mentir.
 *
 * Estar en esta tabla ES ser encargado. No hay más estados.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_user');
    }
};
