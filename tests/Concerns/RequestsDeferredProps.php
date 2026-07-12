<?php

namespace Tests\Concerns;

use App\Models\User;
use Illuminate\Testing\TestResponse;

/**
 * Pide una prop DIFERIDA como la pediría el navegador.
 *
 * ⚠️ HAY QUE MANDAR LA VERSIÓN DE LOS ASSETS, y aprendí por qué a base de un 409.
 *
 * Inertia compara la versión que envías con la suya y, si no cuadran, responde 409 para
 * forzar una recarga completa (es su defensa contra un front viejo hablando con un back
 * nuevo). Mandar la versión vacía funcionaba... hasta que ejecuté `npm run build`: con
 * el manifest en disco, Inertia ya tenía versión, y los tres tests se cayeron.
 *
 * Es decir: los tests pasaban por NO haber compilado. Un test cuyo resultado depende de
 * si alguien compiló antes no prueba nada — y en CI habría fallado el primer día.
 *
 * La solución es la que usa el navegador de verdad: cargar la página, leer su versión, y
 * pedir la prop con esa.
 */
trait RequestsDeferredProps
{
    protected function getDeferred(User $user, string $url, string $component, string $prop): TestResponse
    {
        $first = $this->actingAs($user)->get($url);
        $version = $first->viewData('page')['version'] ?? '';

        return $this->actingAs($user)->get($url, [
            'X-Inertia' => 'true',
            'X-Inertia-Version' => $version,
            'X-Inertia-Partial-Component' => $component,
            'X-Inertia-Partial-Data' => $prop,
        ]);
    }
}
