import type { AnyModelClass } from "../table/types/model";
import type { IndexDefineOptions, IndexDefinition } from "./types";

export const Index = {
	/**
	 * Defines a database index for a table.
	 * This definition can be passed to `applySchema` to create the index in SurrealDB.
	 *
	 * @param tableThunk A thunk function that returns the model class. This is used to avoid circular dependency issues.
	 * @param options Configuration for the index.
	 * @returns An index definition object.
	 *
	 * @example
	 * ```ts
	 * // Define a simple unique index
	 * const UserEmailIndex = Index.define(() => User, {
	 *   name: 'user_email_unique',
	 *   fields: ['email'],
	 *   unique: true,
	 * });
	 *
	 * // Define a full-text search index with a specific analyzer
	 * const PostContentFTS = Index.define(() => Post, {
	 *   name: 'post_content_fts',
	 *   fields: ['title', 'content'],
	 *   analyzer: 'english',
	 * });
	 *
	 * // Apply to the database
	 * await applySchema(db, [User, Post, UserEmailIndex, PostContentFTS]);
	 * ```
	 */
	define(
		tableThunk: () => AnyModelClass,
		options: IndexDefineOptions,
	): IndexDefinition {
		const table = tableThunk();
		return {
			_type: "index",
			...options,
			table,
		};
	},
};
