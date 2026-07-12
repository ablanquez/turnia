<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * La parrilla: define qué puestos hacen falta, en qué franja y cuántos.
 */
class Calendar extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->calendars()->create(...). */
    protected $fillable = [
        'name',
        'starts_on',
        'ends_on',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'is_active' => 'boolean',
        ];
    }

    /** withTrashed(): el calendario de una empresa borrada sigue siendo consultable. */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }

    /** Qué contratos juegan en este calendario. */
    public function employments(): BelongsToMany
    {
        return $this->belongsToMany(Employment::class);
    }

    public function coverageRequirements(): HasMany
    {
        return $this->hasMany(CoverageRequirement::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }
}
