export type FacebookErrorCode =
  /** Network failure, timeout, or a non-2xx status. Retrying later may work. */
  | "request_failed"
  /** Rate limited, or served a login wall instead of data. */
  | "blocked"
  /** The response no longer matches the shape we parse; the adapter needs updating. */
  | "format_changed"
  | "not_found";

export class FacebookError extends Error {
  readonly code: FacebookErrorCode;

  constructor(code: FacebookErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "FacebookError";
    this.code = code;
  }
}
