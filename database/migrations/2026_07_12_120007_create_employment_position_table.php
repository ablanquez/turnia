<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Elegibilidad: qué puestos PUEDE cubrir un contrato.
     *
     * Es capacidad, no asignación. Que María pueda estar en caja no la pone
     * en caja: eso lo hace una fila en assignments.
     */
    public function up(): void
    {
        Schema::create('employment_position', function (Blueprint $table) {
            $table->foreignId('employment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('position_id')->constrained()->cascadeOnDelete();

            $table->primary(['employment_id', 'position_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employment_position');
    }
};
