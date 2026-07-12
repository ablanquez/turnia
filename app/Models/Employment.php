<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * El contrato de una persona en una empresa.
 *
 * Todo lo que depende de la empresa cuelga de aquí y no de la persona: el
 * perfil, los límites, los puestos que puede cubrir, los calendarios en los que
 * juega. María puede ser de barra en el Bar A y de cocina en el Bar B.
 */
class Employment extends Model
{
    use HasFactory;
    use SoftDeletes;

    /** company_id fuera: se asigna vía $company->employments()->create(...). */
    protected $fillable = [
        'person_id',
        'profile_id',
        'starts_on',
        'ends_on',
        'max_minutes_year_override',
        'max_minutes_month_override',
        'max_minutes_week_override',
        'max_minutes_per_shift_override',
        'min_rest_minutes_between_shifts_override',
        'max_overtime_minutes_year_override',
        'annual_leave_days_override',
        'workday_type_override',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
        ];
    }

    /** withTrashed(): el contrato sobrevive a la empresa borrada, y sus horas siguen contando. */
    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class)->withTrashed();
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class)->withTrashed();
    }

    public function profile(): BelongsTo
    {
        return $this->belongsTo(Profile::class);
    }

    /** Elegibilidad: qué puestos PUEDE cubrir. */
    public function positions(): BelongsToMany
    {
        return $this->belongsToMany(Position::class);
    }

    /** Participación: en qué calendarios juega. */
    public function calendars(): BelongsToMany
    {
        return $this->belongsToMany(Calendar::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    public function conceptEntries(): HasMany
    {
        return $this->hasMany(ConceptEntry::class);
    }

    /** Solo las de este contrato. Las de la persona están en Person::absences(). */
    public function absences(): HasMany
    {
        return $this->hasMany(Absence::class);
    }
}
