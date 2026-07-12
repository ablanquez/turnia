<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('people', function (Blueprint $table) {
            $table->id();

            // La persona pertenece al empresario, no a una empresa: la misma
            // persona puede tener contrato en varias empresas suyas.
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('first_name');
            $table->string('last_name');
            $table->string('national_id')->nullable();
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->date('birth_date')->nullable();
            $table->timestamps();
            $table->softDeletes();

            // Único cuando está presente: MySQL no considera colisión entre NULLs,
            // así que permite el alta rápida sin DNI e impide duplicados con él.
            //
            // deleted_at NO entra en este índice a propósito: como las filas vivas
            // lo tienen a NULL y MySQL no ve colisión entre NULLs, incluirlo
            // permitiría dos personas VIVAS con el mismo DNI. Una persona borrada
            // sigue ocupando el índice: al reintroducir su DNI hay que restaurarla,
            // no duplicarla.
            $table->unique(['user_id', 'national_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('people');
    }
};
