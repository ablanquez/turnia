<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * El encargado forzó este turno a sabiendas.
 *
 * `violations` es la foto de lo que se le enseñó cuando decidió: un hecho del
 * pasado. NO es el estado actual de los incumplimientos —ese se deriva— y nadie
 * debe leerlo como tal.
 */
class AssignmentOverride extends Model
{
    use HasFactory;

    protected $fillable = [
        'reason',
        'violations',
    ];

    protected function casts(): array
    {
        return [
            'violations' => 'array',
        ];
    }

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(Assignment::class);
    }

    /** Quién lo forzó. */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
