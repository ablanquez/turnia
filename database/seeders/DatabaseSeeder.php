<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /*
     * ⚠️ AQUÍ NO PUEDE IR WithoutModelEvents, Y VENÍA PUESTO DE SERIE.
     *
     * Ese trait apaga los eventos de Eloquent... incluidos los hooks saving() que
     * DERIVAN company_id y person_id del contrato en las asignaciones, los conceptos y
     * las ausencias. Con el trait puesto, el seeder reventaría al insertar (company_id
     * no admite nulo) o, peor, escribiría copias vacías: exactamente la copia que
     * miente contra la que se diseñó el hook.
     */

    public function run(): void
    {
        $this->call(DemoSeeder::class);
    }
}
