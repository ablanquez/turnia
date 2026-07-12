<?php

namespace App\Models;

use App\Enums\Computation;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Catálogo de conceptos horarios: hora médica, permiso retribuido, hora extra.
 *
 * El comportamiento está en el dato (`computation`), no en el código.
 */
class ConceptType extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->conceptTypes()->create(...). */
    protected $fillable = [
        'name',
        'computation',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'computation' => Computation::class,
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function entries(): HasMany
    {
        return $this->hasMany(ConceptEntry::class);
    }
}
