<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Ocupa horas del empleado pero no cubre ningún puesto.
 *
 * Por eso no tiene position_id ni calendar_id: esa ausencia de columnas es la
 * diferencia semántica con Assignment.
 */
class ConceptEntry extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    /** uuid, company_id y person_id se derivan; no llegan de una petición. */
    protected $fillable = [
        'employment_id',
        'concept_type_id',
        'work_date',
        'starts_at',
        'ends_at',
        'notes',
    ];

    public function uniqueIds(): array
    {
        return ['uuid'];
    }

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    /** Igual que en Assignment: las copias denormalizadas se derivan del contrato. */
    protected static function booted(): void
    {
        static::saving(function (self $entry) {
            $employment = Employment::withTrashed()->findOrFail($entry->employment_id);

            $entry->company_id = $employment->company_id;
            $entry->person_id = $employment->person_id;
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employment(): BelongsTo
    {
        return $this->belongsTo(Employment::class);
    }

    public function conceptType(): BelongsTo
    {
        return $this->belongsTo(ConceptType::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }
}
