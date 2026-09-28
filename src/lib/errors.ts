import { z } from "zod";
import { ForbiddenError } from "./permissions";

/**
 * Application error taxonomy. Server actions and route handlers translate
 * these into safe, user-facing results; stack traces never reach the browser.
 */
export class AppError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
      fieldErrors?: Record<string, string[]>;
    } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.code = options.code ?? "app_error";
    this.status = options.status ?? 400;
    this.fieldErrors = options.fieldErrors;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to continue.") {
    super(message, { code: "unauthorized", status: 401 });
  }
}

export class NoOrganizationError extends AppError {
  constructor(
    message = "Your account is not linked to an active organization yet.",
  ) {
    super(message, { code: "no_organization", status: 403 });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "The requested record was not found.") {
    super(message, { code: "not_found", status: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message = "This action conflicts with the current state of the record.") {
    super(message, { code: "conflict", status: 409 });
  }
}

export { ForbiddenError };

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function zodFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return fieldErrors;
}

export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  if (error instanceof z.ZodError) {
    return new AppError("Please correct the highlighted fields.", {
      code: "validation_error",
      status: 422,
      fieldErrors: zodFieldErrors(error),
    });
  }
  if (error instanceof Error) {
    return new AppError(error.message, { code: "internal_error", status: 500 });
  }
  return new AppError("Unexpected error.", { code: "internal_error", status: 500 });
}

export type ActionResult<T = undefined> =
  | ({ ok: true; data: T; message?: string })
  | { ok: false; error: string; code: string; fieldErrors?: Record<string, string[]> };

export function actionSuccess<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

/**
 * Converts a thrown error into a safe action result. Internal errors are
 * logged server-side and reported generically to the client.
 */
export function actionFailure(error: unknown): ActionResult<never> {
  const appError = toAppError(error);
  if (appError.status >= 500) {
    console.error("[action-error]", error);
  }
  return {
    ok: false,
    error: appError.message,
    code: appError.code,
    fieldErrors: appError.fieldErrors,
  };
}
