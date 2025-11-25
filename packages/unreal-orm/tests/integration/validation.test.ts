import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Index, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("validation", "validation");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Validation & Error Handling", () => {
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(), // required
			email: Field.string(), // required
			age: Field.number({ default: surql`18` }), // optional with default
			isActive: Field.bool({ default: surql`true` }),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [User]);
	});

	test("required fields: missing name/email throws", async () => {
		expect(User.create(db, { age: 22 })).rejects.toThrow();
		expect(User.create(db, { name: "Alice" })).rejects.toThrow();
		expect(User.create(db, { email: "a@b.com" })).rejects.toThrow();
	});

	test("type enforcement: wrong types throw", async () => {
		expect(
			// @ts-ignore
			User.create(db, { name: 123, email: "a@b.com" }),
		).rejects.toThrow();
		expect(
			// @ts-ignore
			User.create(db, { name: "Bob", email: false }),
		).rejects.toThrow();
		expect(
			// @ts-ignore
			User.create(db, { name: "Carol", email: "c@d.com", age: "old" }),
		).rejects.toThrow();
	});

	test("default values: age/isActive applied", async () => {
		const user = await User.create(db, { name: "Dana", email: "d@e.com" });
		expect(user.age).toBe(18);
		expect(user.isActive).toBe(true);
	});

	test("optional fields: can be omitted", async () => {
		const user = await User.create(db, { name: "Eve", email: "e@f.com" });
		expect(user).toHaveProperty("age");
		expect(user).toHaveProperty("isActive");
	});

	test("SurrealDB error: unique constraint violation", async () => {
		class UniqueEmailUser extends Table.normal({
			name: "unique_email_user",
			fields: {
				email: Field.string(),
			},
			schemafull: true,
		}) {}
		const UniqueEmailUserIndex = Index.define(() => UniqueEmailUser, {
			name: "unique_email_idx",
			fields: ["email"],
			unique: true,
		});

		await applySchema(db, [UniqueEmailUser, UniqueEmailUserIndex]);
		await UniqueEmailUser.create(db, { email: "unique@x.com" });
		expect(
			UniqueEmailUser.create(db, { email: "unique@x.com" }),
		).rejects.toThrow();
	});

	test("negative: extra/unknown field is ignored or rejected", async () => {
		try {
			const user = await User.create(db, {
				name: "Frank",
				email: "f@g.com",
				// @ts-ignore
				extra: "should not exist",
			});
			// If it succeeds (v2 behavior), ensure the extra field is ignored
			expect(user).not.toHaveProperty("extra");
		} catch (e: unknown) {
			// If it fails (v3 behavior), ensure it's the expected error
			if (e instanceof Error) {
				expect(e.message).toMatch(/no such field exists/i);
			} else {
				throw e;
			}
		}
	});
});
