import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { surql, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("array_test", "array_test");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Field.array - primitive arrays", () => {
	class TagsModel extends Table.normal({
		name: "tags_model",
		fields: {
			tags: Field.array(Field.string(), { max: 5, default: surql`[]` }),
		},
		schemafull: true,
	}) {}

	test("should generate and apply correct SurrealQL for array field with max", async () => {
		const ddl = generateFullSchemaQl([TagsModel]);
		expect(ddl).toContain(
			"DEFINE FIELD tags ON TABLE tags_model TYPE array<string, 5>",
		);
		expect(ddl).toContain("DEFAULT []");
		await applySchema(db, [TagsModel]);
	});

	test("should create and fetch a record with string array", async () => {
		const data = { tags: ["a", "b", "c"] };
		const record = await TagsModel.create(db, data);
		expect(record.tags).toEqual(["a", "b", "c"]);

		const fetched = await TagsModel.select(db, { from: record.id, only: true });
		expect(fetched?.tags).toEqual(["a", "b", "c"]);
		const updated = await fetched?.update(db, {
			mode: "merge",
			data: { tags: ["tag3", "tag4"] },
		});
		expect(updated?.tags).toEqual(["tag3", "tag4"]);
	});

	test("should fail if array exceeds max length", async () => {
		const tooManyTags = { tags: ["a", "b", "c", "d", "e", "f"] };
		expect(TagsModel.create(db, tooManyTags)).rejects.toThrow();
	});
});

describe("Field.array - object arrays", () => {
	class ObjectArrayModel extends Table.normal({
		name: "object_array_model",
		fields: {
			items: Field.array(
				Field.object({ foo: Field.string(), bar: Field.number() }),
				{ default: surql`[]` },
			),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for array of objects", async () => {
		const ddl = generateFullSchemaQl([ObjectArrayModel]);
		expect(ddl).toContain(
			"DEFINE FIELD items ON TABLE object_array_model TYPE array<object>",
		);
		await applySchema(db, [ObjectArrayModel]);
	});

	test("should store and retrieve array of objects", async () => {
		const data = {
			items: [
				{ foo: "hi", bar: 1 },
				{ foo: "yo", bar: 2 },
			],
		};
		const record = await ObjectArrayModel.create(db, data);
		expect(record.items).toEqual(data.items);
		const fetched = await ObjectArrayModel.select(db, {
			from: record.id,
			only: true,
		});
		expect(fetched?.items).toEqual(data.items);
	});
});

describe("Field.array - record (relation) arrays", () => {
	class User extends Table.normal({
		name: "user_array",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Post extends Table.normal({
		name: "post_array",
		fields: {
			title: Field.string(),
			authors: Field.array(Field.record(() => User)),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for array of records", async () => {
		const ddl = generateFullSchemaQl([Post]);
		expect(ddl).toContain(
			"DEFINE FIELD authors ON TABLE post_array TYPE array<record<user_array>>",
		);
		await applySchema(db, [Post]);
	});

	test("should hydrate array of record IDs into model instances", async () => {
		const user1 = await User.create(db, { name: "A" });
		const user2 = await User.create(db, { name: "B" });
		const post = await Post.create(db, {
			title: "Hello",
			authors: [user1.id, user2.id],
		});
		const fetched = await Post.select(db, {
			from: post.id,
			only: true,
			fetch: ["authors"],
		});
		expect(Array.isArray(fetched?.authors)).toBe(true);
		expect(fetched?.authors?.length).toBe(2);
		if (fetched?.authors) {
			for (const author of fetched.authors) {
				expect(author).toHaveProperty("name");
				expect(author).toBeInstanceOf(User);
			}
		} else {
			throw new Error("authors array was not hydrated");
		}
	});
});

describe("Field.array - optional arrays", () => {
	class OptionalArrayModel extends Table.normal({
		name: "optional_array_model",
		fields: {
			items: Field.option(Field.array(Field.number())),
		},
		schemafull: true,
	}) {}

	test("should generate and apply SurrealQL for optional array", async () => {
		const ddl = generateFullSchemaQl([OptionalArrayModel]);
		expect(ddl).toContain(
			"DEFINE FIELD items ON TABLE optional_array_model TYPE option<array<number>>",
		);
		await applySchema(db, [OptionalArrayModel]);
	});
});
