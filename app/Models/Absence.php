<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Bloquea días enteros.
 *
 * Cuelga de la persona. Si employment_id es NULL, afecta a todos sus contratos
 * (una baja: el tobillo roto no distingue de empresas). Si tiene valor, solo a
 * ese contrato (unas vacaciones se cogen en un bar y no en el otro).
 */
class Absence extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    /** uuid y company_id se derivan; no llegan de una petición. */
    protected $fillable = [
        'person_id',
        'employment_id',
        'absence_type_id',
        'starts_on',
        'ends_on',
        'notes',
    ];

    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            // NULL = baja abierta, de duración indefinida.
            'ends_on' => 'date',
        ];
    }

    /**
     * company_id se deriva del catálogo al que pertenece el tipo de ausencia.
     * No puede derivarse del contrato: una baja de persona no tiene contrato.
     */
    protected static function booted(): void
    {
        static::saving(function (self $absence) {
            $absence->company_id = AbsenceType::findOrFail($absence->absence_type_id)->company_id;
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    /** NULL: afecta a todos los contratos de la persona. */
    public function employment(): BelongsTo
    {
        return $this->belongsTo(Employment::class);
    }

    public function absenceType(): BelongsTo
    {
        return $this->belongsTo(AbsenceType::class);
    }
}
