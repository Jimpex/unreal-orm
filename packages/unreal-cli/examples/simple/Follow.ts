import { Table, Field, Index } from "unreal-orm";
import { surql } from "surrealdb";
import { User } from "./User";

/**
 * Example Relation table (Edge) connecting Users.
 *
 * Relations in SurrealDB are special tables that connect two records.
 * They act as "Edges" in the graph database model.
 *
 * Key features:
 * 1. `Table.relation()` factory instead of `Table.normal()`
 * 2. Required `in` (from) and `out` (to) fields
 * 3. Additional metadata fields on the edge itself
 */
export class Follow extends Table.relation({
	name: "follow",
	fields: {
		// The 'in' field points to the source record (Follower)
		in: Field.record(() => User, { assert: surql`$value != NONE` }),

		// The 'out' field points to the target record (Followed)
		out: Field.record(() => User, { assert: surql`$value != NONE` }),

		// Edge Metadata
		// Relations can have their own fields
		status: Field.string({
			default: surql`'pending'`,
			assert: surql`$value INSIDE ['pending', 'accepted', 'blocked']`,
		}),

		created_at: Field.datetime({ value: surql`time::now()`, readonly: true }),
		updated_at: Field.datetime({ value: surql`time::now()` }),
	},
}) {}

/**
 * Unique index on in+out ensures a user can only follow another user once
 */
export const idx_follow_unique = Index.define(() => Follow, {
	name: "idx_follow_unique",
	fields: ["in", "out"],
	unique: true,
});

export const FollowDefinitions = [Follow, idx_follow_unique];
