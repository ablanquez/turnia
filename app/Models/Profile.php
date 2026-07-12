<?php

namespace App\Models;

use App\Enums\WorkdayType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Condiciones y límites reutilizables. Define CUÁNTO puede trabajar alguien,
 * no QUÉ puede hacer: la cualificación vive en employment_position.
 */
class Profile extends Model
{
    use HasFactory;

    /** company_id fuera: se asigna vía $company->profiles()->create(...). */
    protected $fillable = [
        'name',
        'max_minutes_year',
        'max_minutes_month',
        'max_minutes_week',
        'max_minutes_per_shift',
        'min_rest_minutes_between_shifts',
        'max_overtime_minutes_year',
        'annual_leave_days',
        'workday_type',
    ];

    protected function casts(): array
    {
        return [
            'workday_type' => WorkdayType::class,
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function employments(): HasMany
    {
        return $this->hasMany(Employment::class);
    }
}
