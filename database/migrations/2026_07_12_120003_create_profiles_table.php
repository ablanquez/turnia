<?php

use App\Enums\WorkdayType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('name');

            // Todos los límites en MINUTOS enteros: 1800h anuales = 108000.
            // Evita el 7.5 + 7.5 != 15 de los flotantes al acumular miles de filas.
            // NULL significa "sin límite", no "cero".
            $table->unsignedInteger('max_minutes_year')->nullable();
            $table->unsignedInteger('max_minutes_month')->nullable();
            $table->unsignedInteger('max_minutes_week')->nullable();
            $table->unsignedSmallInteger('max_minutes_per_shift')->nullable();
            $table->unsignedSmallInteger('min_rest_minutes_between_shifts')->nullable();

            // Tope del contador aparte (horas extra). Depende del contrato:
            // un parcial de 20h no tiene el mismo techo que una jornada completa.
            $table->unsignedInteger('max_overtime_minutes_year')->nullable();

            // Cupo de vacaciones en días laborables. Qué ausencias lo consumen
            // lo dice absence_types.consumes_leave_quota.
            $table->unsignedSmallInteger('annual_leave_days')->nullable();

            $table->string('workday_type')->default(WorkdayType::Any->value);

            $table->timestamps();

            $table->unique(['company_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('profiles');
    }
};
