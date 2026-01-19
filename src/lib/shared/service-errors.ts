/**
 * Typed service errors for consistent error handling across the application.
 * Routes catch these errors and handle them appropriately (fail(), error(), etc.)
 */

export interface ValidationIssue {
	field: string;
	message: string;
}

class NotFoundError extends Error {
	readonly type = 'NotFound' as const;

	constructor(message: string) {
		super(message);
		this.name = 'NotFoundError';
	}
}

class NotAuthorizedError extends Error {
	readonly type = 'NotAuthorized' as const;

	constructor(message: string) {
		super(message);
		this.name = 'NotAuthorizedError';
	}
}

class ValidationError extends Error {
	readonly type = 'Validation' as const;
	readonly issues: ValidationIssue[];

	constructor(issues: ValidationIssue[]) {
		const message = issues.map((i) => `${i.field}: ${i.message}`).join(', ');
		super(message);
		this.name = 'ValidationError';
		this.issues = issues;
	}
}

class StorageError extends Error {
	readonly type = 'Storage' as const;

	constructor(message: string) {
		super(message);
		this.name = 'StorageError';
	}
}

export const ServiceError = {
	NotFound: NotFoundError,
	NotAuthorized: NotAuthorizedError,
	Validation: ValidationError,
	Storage: StorageError
};
