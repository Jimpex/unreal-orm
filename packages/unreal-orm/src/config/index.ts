/**
 * Configuration Module
 *
 * Provides global database configuration for ORM methods.
 * Allows using `.select(options)` instead of `.select(db, options)`.
 *
 * @module
 */

import type { SurrealLike } from "../define/table/types/model";

// ============================================================================
// INTERNAL STATE
// ============================================================================

/** Cached database instance */
let cachedDatabase: SurrealLike | null = null;

/** Factory function to create database connection */
let databaseFactory: (() => SurrealLike | Promise<SurrealLike>) | null = null;

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Configuration options for the ORM.
 */
export interface ConfigureOptions {
	/**
	 * A pre-connected database instance.
	 * Use this when you already have a connected Surreal instance.
	 */
	database?: SurrealLike;

	/**
	 * A factory function that returns or creates a database connection.
	 * Called lazily on first use. The result is cached.
	 *
	 * @example
	 * ```ts
	 * configure({
	 *   getDatabase: async () => {
	 *     const db = new Surreal();
	 *     await db.connect("ws://localhost:8000");
	 *     await db.signin({ username: "root", password: "root" });
	 *     await db.use({ namespace: "test", database: "test" });
	 *     return db;
	 *   }
	 * });
	 * ```
	 */
	getDatabase?: () => SurrealLike | Promise<SurrealLike>;
}

/**
 * Configures the global database connection for the ORM.
 *
 * After calling `configure()`, you can use ORM methods without passing `db`:
 * ```ts
 * // Before: always pass db
 * const users = await User.select(db, { limit: 10 });
 *
 * // After: db is optional
 * const users = await User.select({ limit: 10 });
 * ```
 *
 * @param options - Configuration options
 *
 * @example
 * ```ts
 * // Option 1: Pass a pre-connected database
 * const db = new Surreal();
 * await db.connect("ws://localhost:8000");
 * configure({ database: db });
 *
 * // Option 2: Use a factory function (lazy initialization)
 * configure({
 *   getDatabase: async () => {
 *     const db = new Surreal();
 *     await db.connect(process.env.SURREAL_URL);
 *     return db;
 *   }
 * });
 * ```
 */
export function configure(options: ConfigureOptions): void {
	if (options.database) {
		cachedDatabase = options.database;
		databaseFactory = null;
	}

	if (options.getDatabase) {
		databaseFactory = options.getDatabase;
		// Don't clear cached database - allow both to coexist
		// Factory will only be used if cached is null
	}
}

/**
 * Clears the global database configuration.
 * Useful for testing or when switching connections.
 */
export function clearConfig(): void {
	cachedDatabase = null;
	databaseFactory = null;
}

// ============================================================================
// DATABASE ACCESS
// ============================================================================

/**
 * Gets the configured database instance.
 * If a factory was provided, it will be called and the result cached.
 *
 * @throws Error if no database is configured
 * @returns The database instance
 *
 * @example
 * ```ts
 * // In a custom model method
 * class User extends Table.normal(...) {
 *   async customMethod() {
 *     const db = await getDatabase();
 *     return db.query(surql`SELECT * FROM user WHERE active = true`);
 *   }
 * }
 * ```
 */
export async function getDatabase(): Promise<SurrealLike> {
	// Return cached database if available
	if (cachedDatabase) {
		return cachedDatabase;
	}

	// Call factory if available
	if (databaseFactory) {
		const result = databaseFactory();
		cachedDatabase = result instanceof Promise ? await result : result;
		return cachedDatabase;
	}

	throw new Error(
		"No database configured. Call configure({ database: db }) or configure({ getDatabase: () => db }) first, " +
			"or pass db explicitly to the method.",
	);
}

/**
 * Checks if a database is configured (either directly or via factory).
 *
 * @returns true if a database is configured
 */
export function hasDatabase(): boolean {
	return cachedDatabase !== null || databaseFactory !== null;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a SurrealLike database instance.
 * Used internally to distinguish between `select(db, options)` and `select(options)`.
 *
 * @param value - Value to check
 * @returns true if value is a SurrealLike instance
 */
export function isSurrealLike(value: unknown): value is SurrealLike {
	if (!value || typeof value !== "object") {
		return false;
	}

	const obj = value as Record<string, unknown>;

	// Check for the core methods that define SurrealLike
	return (
		typeof obj.query === "function" &&
		typeof obj.select === "function" &&
		typeof obj.create === "function" &&
		typeof obj.update === "function" &&
		typeof obj.delete === "function"
	);
}
