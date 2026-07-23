// Tests for schema migration, applySchema

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
	Field,
	Index,
	Table,
	Bucket,
	applySchema,
	compareSchemas,
	generateMigrationSurql,
	extractSchemaFromDefinables,
} from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("migration", "migration");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Schema Migration", () => {
	test("should apply schema for new tables and indexes", async () => {
		class User extends Table.normal({
			name: "user_mig",
			fields: { name: Field.string(), email: Field.string() },
			schemafull: true,
		}) {}
		class Post extends Table.normal({
			name: "post_mig",
			fields: { title: Field.string() },
			schemafull: true,
		}) {}
		const UserEmailIndex = Index.define(() => User, {
			name: "idx_user_email",
			fields: ["email"],
			unique: true,
		});

		await applySchema(db, [User, UserEmailIndex, Post]);
		// Try creating a user with duplicate email
		await User.create(db, { name: "A", email: "a@x.com" });
		expect(User.create(db, { name: "B", email: "a@x.com" })).rejects.toThrow();
		// Table existence: try creating a post
		const post = await Post.create(db, { title: "test" });
		expect(post.title).toBe("test");
	});

	test("should be idempotent (multiple applySchema calls)", async () => {
		class Foo extends Table.normal({
			name: "foo_mig",
			fields: { bar: Field.string() },
			schemafull: true,
		}) {}
		await applySchema(db, [Foo]);
		const rec = await Foo.create(db, { bar: "baz" });
		expect(rec.bar).toBe("baz");
	});

	test("generates migration SQL for bucket changes", () => {
		const AvatarBucket = Bucket.define({
			name: "avatars",
			backend: "memory",
		});

		const local = extractSchemaFromDefinables([AvatarBucket]);
		const remote: import("../../src").SchemaAST = { tables: [] };

		const changes = compareSchemas(local, remote);
		const migration = generateMigrationSurql(changes);

		expect(migration).toContain("DEFINE BUCKET avatars BACKEND 'memory';");
	});

	test("generates REMOVE BUCKET for removed buckets", () => {
		const AvatarBucket = Bucket.define({
			name: "avatars",
			backend: "memory",
		});

		const local: import("../../src").SchemaAST = { tables: [] };
		const remote = extractSchemaFromDefinables([AvatarBucket]);

		const changes = compareSchemas(local, remote);
		const migration = generateMigrationSurql(changes);

		expect(migration).toContain("REMOVE BUCKET avatars;");
	});

	test("generates ALTER BUCKET for modified buckets", () => {
		const StaticBucketOld = Bucket.define({
			name: "static",
			backend: "memory",
		});

		const StaticBucketNew = Bucket.define({
			name: "static",
			backend: "file:/data/static",
			readonly: true,
		});

		const local = extractSchemaFromDefinables([StaticBucketNew]);
		const remote = extractSchemaFromDefinables([StaticBucketOld]);

		const changes = compareSchemas(local, remote);
		const migration = generateMigrationSurql(changes);

		expect(migration).toContain(
			"ALTER BUCKET static READONLY BACKEND 'file:/data/static';",
		);
	});
});
