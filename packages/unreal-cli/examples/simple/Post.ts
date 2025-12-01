import { Table, Field, Index } from "unreal-orm";
import { surql } from "surrealdb";
import type { Surreal } from "surrealdb";
import { User } from "./User";

/**
 * Example Post table demonstrating record links and complex fields.
 *
 * Key features:
 * 1. Record links (foreign keys) to other tables
 * 2. Array fields for tags
 * 3. Enum-like validation using assertions
 * 4. Instance & Static methods for business logic
 */
export class Post extends Table.normal({
	name: "post",
	fields: {
		title: Field.string({ assert: surql`$value != NONE` }),
		slug: Field.string({ assert: surql`$value != NONE` }),
		content: Field.string(),
		excerpt: Field.string(),

		// Enum-like behavior using assertions
		// Validates that status is one of the allowed strings
		status: Field.string({
			default: surql`'draft'`,
			assert: surql`$value INSIDE ['draft', 'published', 'archived']`,
		}),

		// Record Link (Foreign Key)
		// Points to a record in the User table
		author: Field.record(() => User, { assert: surql`$value != NONE` }),

		published_at: Field.datetime(),

		// Timestamps using value/readonly pattern
		created_at: Field.datetime({ value: surql`time::now()`, readonly: true }),
		updated_at: Field.datetime({ value: surql`time::now()` }),

		// Array field - stores a list of strings
		tags: Field.array(Field.string()),

		view_count: Field.int({ default: surql`0` }),
	},
}) {
	/**
	 * Example Instance Method: Business Logic
	 * Encapsulate logic to update state
	 */
	async publish(db: Surreal) {
		if (this.status === "published") return this;

		return this.update(db, {
			mode: "merge",
			data: {
				status: "published",
				published_at: new Date(),
			},
		});
	}

	/**
	 * Example Static Method: Custom Query
	 * Encapsulate common queries
	 */
	static async findPublished(db: Surreal) {
		return this.select(db, {
			where: surql`status = 'published'`,
			order: { published_at: "DESC" },
			limit: 10,
		});
	}
}

/**
 * Unique index on slug ensures URL-friendly identifiers are unique
 */
export const idx_post_slug = Index.define(() => Post, {
	name: "idx_post_slug",
	fields: ["slug"],
	unique: true,
});

/**
 * Index on author allows efficient "get all posts by user" queries
 */
export const idx_post_author = Index.define(() => Post, {
	name: "idx_post_author",
	fields: ["author"],
});

export const PostDefinitions = [Post, idx_post_slug, idx_post_author];
