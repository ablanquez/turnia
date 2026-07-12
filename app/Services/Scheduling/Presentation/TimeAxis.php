<?php

namespace App\Services\Scheduling\Presentation;

use App\Models\Company;
use Carbon\CarbonImmutable;

/**
 * EL EJE X DE LA PARRILLA. La única aritmética de tiempo que hay en toda la vista.
 *
 * Convierte un instante UTC en una POSICIÓN sobre el día local de negocio, medida
 * en horas decimales desde la medianoche de ese work_date. Un turno de 22:00 a
 * 06:00 del día siguiente va de la hora 22 a la 30: por eso se VE cruzando el
 * borde del día, sin ningún caso especial.
 *
 * ⚠️ ESTO SE CALCULA EN EL SERVIDOR, Y NO ES UN CAPRICHO.
 *
 * Si el navegador convirtiera de UTC a local, usaría LA ZONA DEL NAVEGADOR, no la
 * de la empresa. Un encargado que abriera desde Canarias el cuadrante de un bar de
 * Madrid vería todos los turnos corridos una hora: un aviso falso visual, del peor
 * tipo, porque no parece un error sino un dato. El cliente no hace ni una sola
 * operación con fechas.
 *
 * La posición es la HORA DE RELOJ local, no la duración transcurrida. Es lo
 * correcto para pintar: el encargado lee "entra a las 22:00" en el eje. La
 * duración real (que la noche del cambio de hora no coincide con la del reloj) la
 * calcula el contador desde los instantes UTC, y esa sí no puede mentir.
 *
 * El eje arranca a las 06:00 y termina a las 06:00 del día siguiente, pero SE
 * ENSANCHA si algo se sale (una panadería que entra a las 04:00). Nunca recorta:
 * una barra recortada es una mentira dibujada.
 */
final class TimeAxis
{
    private const DEFAULT_FROM = 6.0;

    private const DEFAULT_TO = 30.0;

    private function __construct(
        public readonly float $from,
        public readonly float $to,
    ) {}

    /**
     * @param  array<int, float>  $hours  Todas las horas que hay que poder pintar.
     */
    public static function covering(array $hours): self
    {
        $from = min(self::DEFAULT_FROM, ...$hours ?: [self::DEFAULT_FROM]);
        $to = max(self::DEFAULT_TO, ...$hours ?: [self::DEFAULT_TO]);

        return new self(floor($from), ceil($to));
    }

    /**
     * La hora local de un instante, medida desde la medianoche del día de negocio.
     *
     * Puede pasar de 24 (el turno acaba al día siguiente) y puede ser negativa (el
     * turno empezó la víspera). Las dos cosas son reales y las dos se pintan.
     */
    public static function hourOf(CarbonImmutable $instantUtc, CarbonImmutable $workDate, Company $company): float
    {
        $local = $instantUtc->setTimezone($company->timezone);

        // ⚠️ EL DESFASE SE CUENTA ENTRE DÍAS DE CALENDARIO, NUNCA ENTRE INSTANTES.
        //
        // Aquí hubo un bug que no reventaba: pintaba. La medianoche del work_date es
        // un instante UTC; la medianoche LOCAL de ese mismo día es otro (las 22:00 UTC
        // de la víspera, en Madrid en verano). Restarlos daba -0,083 días, que por 24
        // son exactamente -2 HORAS, y toda la parrilla salía dos horas antes de su hora
        // real. Nadie habría visto un error: habría visto un cuadrante.
        //
        // Y lo peor: con la empresa en UTC el desfase es CERO, así que un test escrito
        // sin zona horaria habría pasado en verde.
        //
        // Reduciendo los dos extremos a su DÍA DE CALENDARIO, la resta es entera y no
        // hay husos que valgan.
        $base = CarbonImmutable::parse($workDate->toDateString());
        $localDay = CarbonImmutable::parse($local->toDateString());

        $dayOffset = (int) $base->diffInDays($localDay, false);

        return $dayOffset * 24 + $local->hour + $local->minute / 60;
    }

    /** Dónde cae esa hora, en tanto por ciento del ancho del carril. */
    public function percent(float $hour): float
    {
        return ($hour - $this->from) / ($this->to - $this->from) * 100;
    }

    /** Las marcas del regla horaria, cada 3 horas. */
    public function ticks(): array
    {
        $ticks = [];

        for ($h = $this->from; $h <= $this->to; $h += 3) {
            $ticks[] = [
                'hour' => $h,
                'label' => str_pad((string) (((int) $h) % 24), 2, '0', STR_PAD_LEFT),
                'percent' => $this->percent($h),
            ];
        }

        return $ticks;
    }

    public function toArray(): array
    {
        return [
            'from' => $this->from,
            'to' => $this->to,
            'ticks' => $this->ticks(),
        ];
    }
}
