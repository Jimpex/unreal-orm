import { Table, Field, Index } from "unreal-orm";
import { surql } from "surrealdb";

/**
 * Example User table using UnrealORM.
 *
 * This demonstrates:
 * 1. Defining a schemafull table (default)
 * 2. Adding fields with constraints and defaults
 * 3. Using indexes for performance and uniqueness
 */
export class User extends Table.normal({
	// The actual table name in SurrealDB
	name: "user",

	fields: {
		// Required fields with assertions
		// The `assert` clause ensures the field is never NONE (null/undefined)
		email: Field.string({ assert: surql`$value != NONE` }),
		username: Field.string({ assert: surql`$value != NONE` }),

		// Optional fields (can be NONE)
		display_name: Field.string(),
		avatar_url: Field.string(),
		bio: Field.string(),

		// Field with a default value
		is_active: Field.bool({ default: surql`true` }),

		// Automatic timestamps
		// `readonly: true` prevents manual updates to created_at
		// `value: ...` sets the value on every create/update
		created_at: Field.datetime({ value: surql`time::now()`, readonly: true }),
		updated_at: Field.datetime({ value: surql`time::now()` }),
	},
}) {}

// Indexes are defined separately from the table but linked via the class getter
// This keeps the table definition clean and focused on data structure

/**
 * Unique index on email to prevent duplicate accounts
 */
export const idx_user_email = Index.define(() => User, {
	name: "idx_user_email",
	fields: ["email"],
	unique: true,
});

/**
 * Unique index on username for lookups and profile URLs
 */
export const idx_user_username = Index.define(() => User, {
	name: "idx_user_username",
	fields: ["username"],
	unique: true,
});

// Export all definitions for the schema applicator
export const UserDefinitions = [User, idx_user_email, idx_user_username];
