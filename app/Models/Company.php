<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    /**
     * "Las 22:00 del 25 de octubre en el bar" -> el instante UTC que se guarda.
     *
     * Los turnos se guardan como instantes UTC. La zona de la empresa solo sirve
     * para interpretar lo que teclea el humano y para pintar. Así, la noche del
     * cambio de hora, un turno de 22:00 a 06:00 dura 9h de verdad y no 8h, sin
     * ningún caso especial en el contador.
     */
    public function toUtc(string $localDate, string $localTime): CarbonImmutable
    {
        return CarbonImmutable::parse("$localDate $localTime", $this->timezone)->utc();
    }

    /**
     * La inversa de toUtc(): el instante guardado, contado en el reloj de la empresa.
     *
     * ⚠️ TODO MENSAJE QUE NOMBRE UNA HORA TIENE QUE PASAR POR AQUÍ.
     *
     * Los turnos se guardan en UTC. Si una regla escribe $turno->starts_at->format('H:i')
     * está imprimiendo la hora UTC, y en Madrid en verano eso son DOS HORAS MENOS. El
     * aviso sería correcto y la hora que da, falsa: "ya tiene un turno de 12:00 a 18:00"
     * cuando en realidad es de 14:00 a 20:00. El encargado miraría las 12:00 de su
     * parrilla, no encontraría nada, y dejaría de creerse los avisos.
     *
     * Un aviso que miente en los detalles es peor que ningún aviso.
     */
    public function localTime(DateTimeInterface $instant): string
    {
        return CarbonImmutable::parse($instant)
            ->setTimezone($this->timezone)
            ->format('H:i');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Los ENCARGADOS. El dueño NO está aquí: vive en user_id, y con una vez basta. */
    public function managers(): BelongsToMany
    {
        return $this->belongsToMany(User::class)->withTimestamps();
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
