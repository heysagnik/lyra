/**
 * Standard AppError and Result types across domain boundaries.
 */

export type AppErrorCode =
  | "AUTH"
  | "RATE_LIMITED"
  | "PROVIDER"
  | "TOOL"
  | "DB"
  | "VALIDATION"
  | "INTERNAL";

export interface AppError {
  code: AppErrorCode;
  message: string;
  cause?: unknown;
  retryAfter?: number;
}

export type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function makeAppError(
  code: AppErrorCode,
  message: string,
  options?: { cause?: unknown; retryAfter?: number }
): AppError {
  return {
    code,
    message,
    cause: options?.cause,
    retryAfter: options?.retryAfter,
  };
}

export interface StructuredLogContext {
  userId?: string;
  conversationId?: string;
  messageId?: string;
  code?: AppErrorCode | string;
  msg: string;
  [key: string]: unknown;
}

export function logStructuredError(context: StructuredLogContext): void {
  console.error(JSON.stringify(context));
}
