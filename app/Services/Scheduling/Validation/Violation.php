<?php

namespace App\Services\Scheduling\Validation;

use App\Enums\RuleCode;
use App\Enums\Severity;

/**
 * Una regla incumplida: qué regla, de qué gravedad, con un mensaje para el humano
 * y el contexto con los datos del choque (para que la interfaz pueda explicarlo).
 */
final readonly class Violation
{
    public function __construct(
        public RuleCode $code,
        public Severity $severity,
        public string $message,
        public array $context = [],
    ) {}

    public static function impossible(RuleCode $code, string $message, array $context = []): self
    {
        return new self($code, Severity::Impossible, $message, $context);
    }

    public static function breach(RuleCode $code, string $message, array $context = []): self
    {
        return new self($code, Severity::Breach, $message, $context);
    }

    public static function notice(RuleCode $code, string $message, array $context = []): self
    {
        return new self($code, Severity::Notice, $message, $context);
    }

    public function toArray(): array
    {
        return [
            'code' => $this->code->value,
            'severity' => $this->severity->value,
            'message' => $this->message,
            'context' => $this->context,
        ];
    }
}
