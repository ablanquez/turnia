<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Festivo de la empresa.
 *
 * Hace falta para contar el cupo de vacaciones en días laborables: los sábados
 * y domingos se deducen (y son configurables en Company), pero el 12 de octubre
 * no se deduce de nada.
 */
class Holiday extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->holidays()->create(...). */
    protected $fillable = [
        'date',
        'name',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }
}
