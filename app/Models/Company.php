<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Company extends Model
{
    use HasFactory;
    use SoftDeletes;

    /**
     * user_id queda deliberadamente fuera: es el campo que decide DE QUIÉN son
     * los datos. Se asigna vía la relación ($user->companies()->create(...)),
     * nunca desde una petición.
     */
    protected $fillable = [
        'name',
        'timezone',
        'computation_year_start_month',
        'computation_year_start_day',
        'non_working_weekdays',
    ];

    /**
     * Sábado y domingo. Es solo el valor por defecto: la empresa puede decidir
     * que su día no laborable es el lunes.
     */
    protected $attributes = [
        'non_working_weekdays' => '[6,7]',
    ];

    protected function casts(): array
    {
        return [
            'non_working_weekdays' => 'array',
            'computation_year_start_month' => 'integer',
            'computation_year_start_day' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function employments(): HasMany
    {
        return $this->hasMany(Employment::class);
    }

    public function profiles(): HasMany
    {
        return $this->hasMany(Profile::class);
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class);
    }

    public function calendars(): HasMany
    {
        return $this->hasMany(Calendar::class);
    }

    public function conceptTypes(): HasMany
    {
        return $this->hasMany(ConceptType::class);
    }

    public function absenceTypes(): HasMany
    {
        return $this->hasMany(AbsenceType::class);
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(Holiday::class);
    }
}
