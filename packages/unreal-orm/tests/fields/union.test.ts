import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Surreal } from "surrealdb";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("union_test", "union_test");
});

afterAll(async () => {
	await teardownDb(db);
});

describe("Field.union", () => {
	class UnionModel extends Table.normal({
		name: "union_model",
		fields: {
			status: Field.union([Field.literal("draft"), Field.literal("published")]),
			mixed: Field.union([Field.string(), Field.int()]),
			optionalMixed: Field.option(
				Field.union([Field.literal("N/A"), Field.datetime(), Field.uuid()]),
			),
		},
		schemafull: true,
	}) {}

	test("generates surrealql for union fields", async () => {
		const ddl = generateFullSchemaQl([UnionModel]);

		expect(ddl).toContain(
			'DEFINE FIELD status ON TABLE union_model TYPE "draft" | "published"',
		);
		expect(ddl).toContain(
			"DEFINE FIELD mixed ON TABLE union_model TYPE string | int",
		);
		expect(ddl).toContain(
			'DEFINE FIELD optionalMixed ON TABLE union_model TYPE option<"N/A" | datetime | uuid>',
		);

		await applySchema(db, [UnionModel], "OVERWRITE");
	});

	test("writes and reads allowed union branches", async () => {
		const draftRecord = await UnionModel.create(db, {
			status: "draft",
			mixed: "alpha",
			optionalMixed: "N/A",
		});

		expect(draftRecord.status).toBe("draft");
		expect(draftRecord.mixed).toBe("alpha");
		expect(draftRecord.optionalMixed).toBe("N/A");

		const numericRecord = await UnionModel.create(db, {
			status: "published",
			mixed: 42,
			optionalMixed: undefined,
		});

		expect(numericRecord.status).toBe("published");
		expect(numericRecord.mixed).toBe(42);
		expect(numericRecord.optionalMixed).toBeUndefined();

		const fetched = await UnionModel.select(db, {
			from: numericRecord.id,
			only: true,
		});

		expect(fetched?.status).toBe("published");
		expect(fetched?.mixed).toBe(42);
		expect(fetched?.optionalMixed).toBeUndefined();
	});

	test("rejects disallowed union values", async () => {
		expect(
			UnionModel.create(db, {
				// @ts-expect-error intentional negative test
				status: "archived",
				mixed: "alpha",
				optionalMixed: undefined,
			}),
		).rejects.toThrow();
	});

	test("rejects empty unions", () => {
		expect(() => Field.union([])).toThrow(
			"Field.union requires at least one field definition.",
		);
	});
});
