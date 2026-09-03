export type ServiceErrorCode =
  | "PRODUCT_NOT_FOUND"
  | "INSUFFICIENT_STOCK"
  | "IDEMPOTENCY_CONFLICT"
  | "INVALID_REFERENCE"
  | "NO_DEFAULT_WAREHOUSE"
  | "SERIALIZATION_RETRY_EXHAUSTED";

export class ServiceError extends Error {
  constructor(readonly code: ServiceErrorCode) {
    super(code);
    this.name = "ServiceError";
  }
}
