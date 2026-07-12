<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * El empleado está cubriendo un puesto, en una franja horaria concreta.
 *
 * Una jornada partida son dos filas el mismo día (9-13 y 17-21). El modelo no
 * necesita saber que "es una partida": lo es de facto.
 */
class Assignment extends Model
{
    use HasFactory;
    use HasUuids;
    use SoftDeletes;

    /**
     * uuid queda fuera: lo genera HasUuids, no llega nunca de una petición.
     * company_id y person_id se derivan del contrato al crear la asignación.
     */
    protected $fillable = [
        'calendar_id',
        'employment_id',
        'position_id',
        'work_date',
        'starts_at',
        'ends_at',
        'notes',
    ];

    /**
     * El UUID va en una columna secundaria: la clave primaria sigue siendo el id
     * autoincremental, así que las claves foráneas siguen siendo enteras.
     *
     * Sobrevive a las ediciones del turno, y por eso un evento exportado a
     * iCalendar o Google Calendar se ACTUALIZA en vez de duplicarse.
     */
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

    /**
     * company_id y person_id son copias denormalizadas del contrato. Se derivan
     * siempre de él, nunca las manda el cliente: una copia que puede mentir es
     * peor que no tenerla.
     */
    protected static function booted(): void
    {
        static::saving(function (self $assignment) {
            $employment = Employment::withTrashed()->findOrFail($assignment->employment_id);

            $assignment->company_id = $employment->company_id;
            $assignment->person_id = $employment->person_id;
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

    public function employment(): BelongsTo
    {
        return $this->belongsTo(Employment::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    /** Denormalizada: el solape y el descanso se validan a nivel de persona. */
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    /** La decisión humana de forzar este turno, si la hubo. */
    public function override(): HasOne
    {
        return $this->hasOne(AssignmentOverride::class);
    }
}
