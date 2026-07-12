<?php

namespace App\Models;

use App\Enums\AbsenceScope;
use App\Enums\Computation;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Catálogo de ausencias: baja laboral, vacaciones, permisos largos.
 *
 * El motor no sabe qué son "las vacaciones". Sabe que hay tipos de ausencia con
 * un `computation`, un `scope` y una marca de si consumen cupo. La empresa
 * rellena el catálogo.
 */
class AbsenceType extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->absenceTypes()->create(...). */
    protected $fillable = [
        'name',
        'computation',
        'scope',
        'consumes_leave_quota',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'computation' => Computation::class,
            'scope' => AbsenceScope::class,
            'consumes_leave_quota' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }

    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class);
    }
}
