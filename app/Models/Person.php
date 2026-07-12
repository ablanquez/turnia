<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * La persona. Existe una sola vez y pertenece al empresario, no a una empresa:
 * puede tener contrato en varias empresas suyas.
 */
class Person extends Model
{
    use HasFactory;
    use SoftDeletes;

    /** user_id fuera: se asigna vía $user->people()->create(...). */
    protected $fillable = [
        'first_name',
        'last_name',
        'national_id',
        'email',
        'phone',
        'birth_date',
    ];

    protected function casts(): array
    {
        return [
            'birth_date' => 'date',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Un contrato por cada empresa en la que trabaja. */
    public function employments(): HasMany
    {
        return $this->hasMany(Employment::class);
    }

    /** Cuelgan de la persona porque una baja bloquea todos sus contratos. */
    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class);
    }

    /** Todas sus asignaciones, en todas las empresas: solape y descanso mínimo. */
    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function conceptEntries(): HasMany
    {
        return $this->hasMany(ConceptEntry::class);
    }
}
