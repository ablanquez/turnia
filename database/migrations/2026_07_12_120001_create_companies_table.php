<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('timezone')->default('Europe/Madrid');

            // El año de cómputo se repite cada año: guardar mes y día, no una fecha.
            $table->unsignedTinyInteger('computation_year_start_month')->default(1);
            $table->unsignedTinyInteger('computation_year_start_day')->default(1);

            // Días de la semana que la empresa NO considera laborables (ISO 1-7).
            // Es un parámetro: hay negocios que abren en domingo y libran el lunes.
            $table->json('non_working_weekdays')->nullable();

            $table->timestamps();

            // Borrar una empresa arrastraría años de datos laborales. Con soft
            // delete, delete() es un UPDATE: el cascadeOnDelete de las FKs nunca
            // se dispara en la operación normal, y restaurar la devuelve entera.
            $table->softDeletes();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
