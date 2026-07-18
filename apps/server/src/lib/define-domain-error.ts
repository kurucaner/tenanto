/**
 * Factory for legacy-style named error classes during gradual migration to [`DomainError`](./domain-error.ts).
 *
 * Prefer `DomainError` + `createDomainError` for new code. Use this when a route still checks
 * `instanceof SomeNamedError` until Phase 2+ migrates the handler.
 */
export function defineDomainError(defaultMessage: string) {
  return class extends Error {
    constructor(message = defaultMessage) {
      super(message);
      this.name = new.target.name;
    }
  };
}
