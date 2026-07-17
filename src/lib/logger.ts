/**
 * ClubLab — Structured Logger
 *
 * Replaces scattered console.error() calls throughout the codebase with a
 * structured logging utility that emits JSON log lines.
 *
 * FASE 4 — TAREA 4.2
 *
 * Features:
 *   • Structured JSON output (compatible with Vercel Logs, Axiom, Betterstack)
 *   • Log levels: debug | info | warn | error
 *   • Debug logs suppressed in production (use NEXT_PUBLIC_DEBUG=true to enable)
 *   • No PII fields — logs should contain IDs, never names or emails
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *
 *   logger.info('sessions.recalculate', { teamId, sessionCount: list.length });
 *   logger.error('analysis.explore', { entityType, error: err.message });
 *   logger.warn('cache.miss', { key, reason: 'ttl_expired' });
 *
 * Log context conventions:
 *   - orgId:     organization UUID
 *   - userId:    user UUID (never email)
 *   - teamId:    team UUID
 *   - durationMs: elapsed time for performance tracking
 *   - rowCount:  number of records returned
 *   - error:     error message string (never the full Error object)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

/** Context values must be serializable primitives — no objects, no PII */
type LogContext = Record<string, string | number | boolean | null | undefined>;

function emit(level: LogLevel, operation: string, context: LogContext = {}): void {
  // Suppress debug logs in production unless explicitly enabled
  if (
    level === "debug" &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_DEBUG !== "true"
  ) {
    return;
  }

  const entry = {
    level,
    operation,
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    ...context,
  };

  const line = JSON.stringify(entry);

  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (operation: string, context?: LogContext) =>
    emit("debug", operation, context),

  info: (operation: string, context?: LogContext) =>
    emit("info", operation, context),

  warn: (operation: string, context?: LogContext) =>
    emit("warn", operation, context),

  error: (operation: string, context?: LogContext) =>
    emit("error", operation, context),
};
