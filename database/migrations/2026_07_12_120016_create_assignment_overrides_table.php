<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El encargado forzó un turno a sabiendas de que incumplía.
     *
     * Esto NO es materializar los incumplimientos: los incumplimientos se derivan
     * re-validando, porque dependen de otras filas y un registro guardado se
     * volvería mentira sin que nadie lo tocara. Lo que sí es dato nuevo, y no se
     * deduce de ninguna otra fila, es la DECISIÓN humana: quién forzó, cuándo y
     * por qué. `violations` es la foto de lo que se le enseñó en ese momento: un
     * hecho del pasado, no un estado que haya que mantener al día.
     */
    public function up(): void
    {
        Schema::create('assignment_overrides', function (Blueprint $table) {
            $table->id();
            $table->foreignId('assignment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('reason');
            $table->json('violations');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('assignment_overrides');
    }
};
