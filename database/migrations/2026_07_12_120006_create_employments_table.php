<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El contrato de una persona en una empresa.
     *
     * Es la pieza central del multi-empresa: la persona existe una vez, pero
     * puede tener un contrato en cada empresa del empresario, con perfil,
     * límites y puestos distintos en cada una.
     */
    public function up(): void
    {
        Schema::create('employments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('person_id')->constrained()->cascadeOnDelete();
            $table->foreignId('profile_id')->nullable()->constrained()->nullOnDelete();

            $table->date('starts_on');
            $table->date('ends_on')->nullable();

            // Excepciones individuales: sobrescriben el perfil vía COALESCE.
            // Viven en el contrato, no en la persona: María puede tener una
            // excepción de horas en el Bar A y no en el Bar B.
            $table->unsignedInteger('max_minutes_year_override')->nullable();
            $table->unsignedInteger('max_minutes_month_override')->nullable();
            $table->unsignedInteger('max_minutes_week_override')->nullable();
            $table->unsignedSmallInteger('max_minutes_per_shift_override')->nullable();
            $table->unsignedSmallInteger('min_rest_minutes_between_shifts_override')->nullable();
            $table->unsignedInteger('max_overtime_minutes_year_override')->nullable();
            $table->unsignedSmallInteger('annual_leave_days_override')->nullable();
            $table->string('workday_type_override')->nullable();

            $table->timestamps();
            $table->softDeletes();

            // Permite recontratar a la misma persona más adelante, pero no
            // duplicar el mismo contrato. Igual que en people, deleted_at queda
            // fuera del índice: un contrato borrado se restaura, no se duplica.
            $table->unique(['company_id', 'person_id', 'starts_on']);

            // "¿Dónde más trabaja María?": el cruce entre empresas.
            $table->index('person_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employments');
    }
};
