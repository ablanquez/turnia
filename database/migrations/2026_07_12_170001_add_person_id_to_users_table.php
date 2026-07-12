<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * El login de un EMPLEADO apunta a su persona.
 *
 * Un usuario con person_id es un empleado; sin él, es un empresario. El papel no
 * es una columna que alguien tenga que mantener al día: se deduce de las
 * relaciones que ya existen, y por tanto no puede desincronizarse.
 *
 * nullOnDelete: si se borra la persona, el login sobrevive pero deja de ser un
 * empleado. Borrar a la persona no debe borrar la cuenta.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('person_id')
                ->nullable()
                ->unique()
                ->after('id')
                ->constrained('people')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('person_id');
        });
    }
};
