<?php

namespace Tests\Feature;

use App\Models\User;
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

    #[Test]
    public function al_entrar_se_aterriza_en_el_panel_y_no_en_un_404(): void
    {
        /*
         * Fortify viene configurado para redirigir a /home DESPUÉS DE ENTRAR, y esta app
         * no tiene /home. Con la contraseña correcta se caía en un 404.
         *
         * Ninguna de mis pruebas lo vio, y el motivo importa: comprobaban el login y el
         * panel POR SEPARADO, sin seguir la redirección. Probar los dos extremos de un
         * salto no prueba el salto.
         */
        $user = User::create([
            'name' => 'Antonio',
            'email' => 'antonio@turnia.test',
            'password' => 'contrasena-larga',
        ]);

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'contrasena-larga',
        ])->assertRedirect('/dashboard');

        $this->assertAuthenticatedAs($user);
    }
}
