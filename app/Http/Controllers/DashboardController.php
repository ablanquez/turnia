<?php

namespace App\Http\Controllers;

use App\Models\Calendar;
use App\Models\Company;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Inertia\Inertia;
use Inertia\Response;

/**
 * La puerta de entrada: las empresas a las que este usuario tiene acceso.
 *
 * No hay una consulta "dame mis empresas", porque no hay una columna que lo diga:
 * se es dueño, encargado o empleado, y las tres cosas se derivan de relaciones
 * distintas. Se unen aquí, y quien no cumpla ninguna no ve nada.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('Dashboard', [
            'companies' => $this->companiesFor($user)
                ->map(fn (Company $company) => [
                    'id' => $company->id,
                    'name' => $company->name,
                    'role' => $this->roleIn($user, $company),
                    'calendars' => $company->calendars
                        ->where('is_active', true)
                        ->map(fn (Calendar $c) => ['id' => $c->id, 'name' => $c->name])
                        ->values(),
                ])
                ->values(),
        ]);
    }

    /** @return Collection<int, Company> */
    private function companiesFor(User $user): Collection
    {
        $owned = $user->companies()->with('calendars')->get();
        $managed = $user->managedCompanies()->with('calendars')->get();

        $employed = $user->person_id === null
            ? new Collection
            : Company::query()
                ->whereHas('employments', fn ($q) => $q->where('person_id', $user->person_id))
                ->with('calendars')
                ->get();

        return $owned->concat($managed)->concat($employed)->unique('id');
    }

    private function roleIn(User $user, Company $company): string
    {
        return match (true) {
            $user->owns($company) => 'Empresario',
            $user->manages($company) => 'Encargado',
            default => 'Empleado',
        };
    }
}
