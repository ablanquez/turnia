<?php

namespace App\Models;

use App\Enums\Recurrence;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * "En agosto, los sábados, de 12:00 a 16:00, hacen falta 3 de barra."
 *
 * La necesidad vive en el tiempo, no en la estructura: en febrero es otra fila
 * con required_count = 1.
 */
class CoverageRequirement extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía la empresa dueña del calendario. */
    protected $fillable = [
        'calendar_id',
        'position_id',
        'effective_from',
        'effective_to',
        'recurrence',
        'day_of_week',
        'on_date',
        'starts_at',
        'ends_at',
        'required_count',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'on_date' => 'date',
            'recurrence' => Recurrence::class,
            'day_of_week' => 'integer',
            'required_count' => 'integer',
        ];
    }

    /** company_id se deriva del calendario: el cliente no la manda, así no puede mentir. */
    protected static function booted(): void
    {
        static::saving(function (self $requirement) {
            $requirement->company_id = Calendar::findOrFail($requirement->calendar_id)->company_id;
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function calendar(): BelongsTo
    {
        return $this->belongsTo(Calendar::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }
}
