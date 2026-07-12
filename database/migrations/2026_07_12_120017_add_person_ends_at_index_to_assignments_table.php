<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * El índice que faltaba, y que solo se vio con datos reales.
     *
     * La regla del descanso busca el turno ANTERIOR de la persona:
     *   WHERE person_id = ? AND ends_at <= ? ORDER BY ends_at DESC LIMIT 1
     *
     * Con el índice (person_id, starts_at) que teníamos, MySQL encontraba las filas por
     * person_id pero tenía que ORDENARLAS a mano por ends_at: "Using filesort" sobre 122
     * filas. Medido sobre 32.000 asignaciones: 0,321 ms.
     *
     * Con (person_id, ends_at), el mismo plan pasa a "Backward index scan" y desaparece
     * el filesort: 0,168 ms. La mitad.
     *
     * Los índices de la tanda 2 se diseñaron a ciegas y acertaron: ninguna consulta
     * crítica hace full scan. Este es el único que faltaba, y solo se ve cuando hay datos
     * y se mira el EXPLAIN.
     */
    public function up(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->index(['person_id', 'ends_at']);
        });
    }

    public function down(): void
    {
        Schema::table('assignments', function (Blueprint $table) {
            $table->dropIndex(['person_id', 'ends_at']);
        });
    }
};
