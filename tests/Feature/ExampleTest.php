<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * NO HAY PARTE PÚBLICA. Ni siquiera de solo lectura.
 *
 * Turnia guarda bajas médicas y permisos por enfermedad. Este test venía de serie
 * comprobando que la portada devolvía un 200; ahora comprueba justo lo contrario: que
 * sin sesión no se llega a ninguna parte.
 */
class ExampleTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function sin_sesion_la_portada_manda_al_login(): void
    {
        $this->get('/')->assertRedirect('/login');
    }

    #[Test]
    public function el_login_si_es_publico(): void
    {
        $this->get('/login')->assertOk();
    }
}
