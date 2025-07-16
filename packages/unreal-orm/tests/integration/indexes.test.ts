import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, Index, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("indexes_test", "indexes_test");
});

afterAll(async () => {
	await teardownDb(db);
});

describe("Index.define()", () => {
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			email: Field.string(),
		},
	}) {}

	const UserEmailIndex = Index.define(() => User, {
		name: "user_email_idx",
		fields: ["email"],
		unique: true,
	});

	test("should apply unique index and enforce uniqueness", async () => {
				await applySchema(db, [User, UserEmailIndex]);

		await User.create(db, { name: "John Doe", email: "john.doe@example.com" });

		expect(
			User.create(db, { name: "Jane Doe", email: "john.doe@example.com" }),
		).rejects.toThrow();
	});
});
