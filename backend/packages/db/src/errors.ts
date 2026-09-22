/**
 * The base every db-layer error extends, so the API can recognise "this was
 * a deliberate refusal, not a crash" without listing each class by name.
 *
 * Before this existed, each controller had to catch its own module's error
 * type and map it, and most of them didn't: ten error classes reached the
 * caller as a bare 500 with no message. An artist was told "Internal server
 * error" when the real answer was "that's below the minimum withdrawal".
 *
 * Message convention, which `http-exception.filter.ts` relies on:
 *
 * - starts with "No " — the thing does not exist, or is not the caller's to
 *   see. Answered as 404, with a generic title, because for anything scoped
 *   to a user a 403 would confirm the id is real.
 * - anything else — a rule the caller broke. Answered as 409, and the
 *   message IS shown, so it must always be safe to put in front of whoever
 *   made the request.
 *
 * A controller that wants a different status or a specific `code` still
 * catches the error itself; this is the floor, not a ceiling.
 */
export class DbError extends Error {}
