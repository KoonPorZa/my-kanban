export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ResourceNotFoundError extends DomainError {
  readonly code = 'not_found';

  constructor(resource: string) {
    super(`${resource} was not found`);
  }
}

export class VersionConflictError extends DomainError {
  readonly code = 'version_conflict';

  constructor(resource: string) {
    super(`${resource} changed since it was loaded`);
  }
}

export class DomainValidationError extends DomainError {
  readonly code = 'invalid_request';

  constructor(message: string) {
    super(message);
  }
}

export class DomainConflictError extends DomainError {
  readonly code = 'conflict';

  constructor(message: string) {
    super(message);
  }
}

export class DomainUnauthorizedError extends DomainError {
  readonly code = 'unauthorized';

  constructor(message = 'Authentication failed') {
    super(message);
  }
}
