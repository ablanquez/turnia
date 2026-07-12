<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Participación: qué contratos juegan en qué calendario.
     *
     * No confundir con employment_position, que es cualificación.
     */
    public function up(): void
    {
        Schema::create('calendar_employment', function (Blueprint $table) {
            $table->foreignId('calendar_id')->constrained()->cascadeOnDelete();
            $table->foreignId('employment_id')->constrained()->cascadeOnDelete();

            $table->primary(['calendar_id', 'employment_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('calendar_employment');
    }
};
