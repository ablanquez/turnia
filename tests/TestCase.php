<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Los tests prueban el CONTRATO DE DATOS, no el empaquetado. Sin esto haría
        // falta un `npm run build` para poder ejecutarlos, y una suite que depende de
        // que alguien haya compilado antes es una suite que un día no se ejecuta.
        $this->withoutVite();
    }
}
