<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * LOS TRES PAPELES NO SON UNA COLUMNA: SE DERIVAN.
 *
 *   EMPRESARIO → es dueño de la empresa (companies.user_id)
 *   ENCARGADO  → está en el pivote company_user
 *   EMPLEADO   → su persona tiene un contrato en esa empresa
 *
 * Guardar el papel en una columna obligaría a mantenerlo sincronizado con esas
 * tres relaciones, y el día que se desincronizara, alguien vería datos que no le
 * tocan. Derivarlo no puede mentir.
 *
 * Un mismo usuario puede ser dos cosas a la vez sin ningún caso especial: el jefe
 * de sala es encargado Y hace turnos.
 */
#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /** El empresario puede tener varias empresas. */
    public function companies(): HasMany
    {
        return $this->hasMany(Company::class);
    }

    /** Las personas son del empresario, no de una empresa: se mueven entre ellas. */
    public function people(): HasMany
    {
        return $this->hasMany(Person::class);
    }

    /** Si apunta a una persona, este login es el de un EMPLEADO. */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class)->withTrashed();
    }

    /**
     * Vincula este login a una persona.
     *
     * ⚠️ person_id NO está en $fillable, Y ES DELIBERADO: es el campo que decide de
     * quién son los datos que ves. Si viajara en una asignación masiva, cualquiera que
     * colara un person_id en un formulario de registro o de perfil se convertiría en
     * otro empleado y vería sus bajas médicas. Mismo criterio que company_id y user_id
     * en el resto del proyecto: los campos de PROPIEDAD se asignan a mano, nunca desde
     * una petición.
     *
     * (Y el fail-closed muerde de verdad: al escribir el seeder intenté pasarlo por
     * create() y Eloquent lo descartó EN SILENCIO. El login existía, pero no era el de
     * nadie. Lo cazó el test de privacidad, con un 403.)
     */
    public function linkTo(Person $person): self
    {
        $this->person()->associate($person)->save();

        return $this;
    }

    /** Las empresas de las que es ENCARGADO. Estar en el pivote es serlo. */
    public function managedCompanies(): BelongsToMany
    {
        return $this->belongsToMany(Company::class)->withTimestamps();
    }

    public function owns(Company $company): bool
    {
        return $company->user_id === $this->id;
    }

    public function manages(Company $company): bool
    {
        return $this->managedCompanies()->whereKey($company->getKey())->exists();
    }

    /** Trabaja ahí: su persona tiene contrato en esa empresa. */
    public function worksAt(Company $company): bool
    {
        if ($this->person_id === null) {
            return false;
        }

        return Employment::query()
            ->where('person_id', $this->person_id)
            ->where('company_id', $company->getKey())
            ->exists();
    }

    /**
     * FAIL-CLOSED: si no es ninguna de las tres cosas, no ve nada.
     *
     * No existe un cuarto caso "usuario autenticado sin más". Estar dentro de
     * Turnia no da acceso a ninguna empresa por defecto.
     */
    public function belongsToCompany(Company $company): bool
    {
        return $this->owns($company)
            || $this->manages($company)
            || $this->worksAt($company);
    }

    /** Puede EDITAR el cuadrante: dueño o encargado. El empleado solo mira. */
    public function canManage(Company $company): bool
    {
        return $this->owns($company) || $this->manages($company);
    }
}
