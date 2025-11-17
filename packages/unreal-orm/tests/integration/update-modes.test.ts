// Tests for all update modes: content, merge, replace, patch

import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import type { JsonPatchOperation } from "../../src";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("update_modes", "update_modes");
});

afterAll(async () => {
	await teardownDb(db);
});

describe("Update Modes - Testing Update Features", () => {
	class User extends Table.normal({
		name: "user_update",
		fields: {
			name: Field.string(),
			age: Field.number(),
			city: Field.option(Field.string()),
			tags: Field.option(Field.array(Field.string())),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [User], "OVERWRITE");
	});

	describe("content mode - full replacement", () => {
		test("should replace all fields with provided data", async () => {
			const user = await User.create(db, {
				name: "Alice",
				age: 30,
				city: "NY",
				tags: ["developer", "javascript"],
			});

			// Update with content mode - should replace all fields
			const updated = await user.update(db, {
				mode: "content",
				data: { name: "Alice Smith", age: 31 },
			});

			expect(updated.name).toBe("Alice Smith");
			expect(updated.age).toBe(31);
			// Unspecified fields should be undefined in content mode
			expect(updated.city).toBeUndefined();
			expect(updated.tags).toBeUndefined();
		});
	});

	describe("merge mode - partial updates", () => {
		test("should merge provided data with existing data", async () => {
			const user = await User.create(db, {
				name: "Carol",
				age: 35,
				city: "Seattle",
				tags: ["manager", "backend"],
			});

			// Update with merge mode - should only update specified fields
			const updated = await user.update(db, {
				mode: "merge",
				data: { age: 36 },
			});

			expect(updated.name).toBe("Carol");
			expect(updated.age).toBe(36);
			// Preserved fields
			expect(updated.city).toBe("Seattle");
			expect(updated.tags).toEqual(["manager", "backend"]);
		});
	});

	describe("replace mode - complete field replacement", () => {
		test("should replace all fields but preserve structure", async () => {
			const user = await User.create(db, {
				name: "Eve",
				age: 28,
				city: "Boston",
				tags: ["frontend", "react"],
			});

			// Update with replace mode - should replace all provided fields
			const updated = await user.update(db, {
				mode: "replace",
				data: { name: "Eve Davis", age: 29, city: "Portland" },
			});

			expect(updated.name).toBe("Eve Davis");
			expect(updated.age).toBe(29);
			expect(updated.city).toBe("Portland");
			// Unspecified fields should be undefined
			expect(updated.tags).toBeUndefined();
		});
	});

	describe("patch mode - JSON patch operations", () => {
		test("should apply JSON patch operations", async () => {
			const user = await User.create(db, {
				name: "Henry",
				age: 45,
				city: "Miami",
				tags: ["senior", "architect"],
			});

			const patchOperations: JsonPatchOperation[] = [
				{ op: "replace", path: "/age", value: 46 },
				{ op: "replace", path: "/tags/0", value: "lead" },
			];

			const updated = await user.update(db, {
				mode: "patch",
				data: patchOperations,
			});

			expect(updated.name).toBe("Henry");
			expect(updated.age).toBe(46);
			expect(updated.city).toBe("Miami");
			expect(updated.tags).toEqual(["lead", "architect"]);
		});

		test("should handle add and remove operations", async () => {
			const user = await User.create(db, {
				name: "Iris",
				age: 33,
				city: "Phoenix",
				tags: ["frontend"],
			});

			const patchOperations: JsonPatchOperation[] = [
				{ op: "replace", path: "/city", value: "Austin" },
				{ op: "remove", path: "/tags" },
			];

			const updated = await user.update(db, {
				mode: "patch",
				data: patchOperations,
			});

			expect(updated.name).toBe("Iris");
			expect(updated.age).toBe(33);
			expect(updated.city).toBe("Austin");
			// tags should be removed
			expect(updated.tags).toBeUndefined();
		});
	});
});
