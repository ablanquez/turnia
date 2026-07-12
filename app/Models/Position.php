<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Position extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->positions()->create(...). */
    protected $fillable = [
        'name',
        'description',
        'color',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }

    /** Quién PUEDE cubrirlo. Es capacidad, no asignación. */
    public function employments(): BelongsToMany
    {
        return $this->belongsToMany(Employment::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function coverageRequirements(): HasMany
    {
        return $this->hasMany(CoverageRequirement::class);
    }
}
