import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Surreal } from "surrealdb";
import { Field, Table, applySchema, generateFullSchemaQl } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("literal_test", "literal_test");
});

afterAll(async () => {
	await teardownDb(db);
});

describe("Field.literal", () => {
	class LiteralModel extends Table.normal({
		name: "literal_model",
		fields: {
			status: Field.literal("draft"),
			noneValue: Field.literal(undefined),
			nullValue: Field.literal(null),
			config: Field.literal({
				value: undefined,
				enabled: true,
				nested: ["draft", null, 1],
			}),
		},
		schemafull: true,
	}) {}

	test("generates surrealql for literal fields", async () => {
		const ddl = generateFullSchemaQl([LiteralModel]);

		expect(ddl).toContain(
			'DEFINE FIELD status ON TABLE literal_model TYPE "draft"',
		);
		expect(ddl).toContain(
			"DEFINE FIELD noneValue ON TABLE literal_model TYPE NONE",
		);
		expect(ddl).toContain(
			"DEFINE FIELD nullValue ON TABLE literal_model TYPE NULL",
		);
		expect(ddl).toContain(
			'DEFINE FIELD config ON TABLE literal_model TYPE { value: NONE, enabled: true, nested: ["draft", NULL, 1] }',
		);

		await applySchema(db, [LiteralModel], "OVERWRITE");
	});

	test("writes and reads matching literal values", async () => {
		const record = await LiteralModel.create(db, {
			status: "draft",
			noneValue: undefined,
			nullValue: null,
			config: {
				value: undefined,
				enabled: true,
				nested: ["draft", null, 1],
			},
		});

		expect(record.status).toBe("draft");
		expect(record.noneValue).toBeUndefined();
		expect(record.nullValue).toBeNull();
		expect(record.config).toEqual({
			value: undefined,
			enabled: true,
			nested: ["draft", null, 1],
		});

		const fetched = await LiteralModel.select(db, {
			from: record.id,
			only: true,
		});

		expect(fetched?.status).toBe("draft");
		expect(fetched?.noneValue).toBeUndefined();
		expect(fetched?.nullValue).toBeNull();
		expect(fetched?.config).toEqual({
			value: undefined,
			enabled: true,
			nested: ["draft", null, 1],
		});
	});

	test("rejects non-matching literal values", async () => {
		expect(
			LiteralModel.create(db, {
				// @ts-expect-error intentional negative test
				status: "published",
				noneValue: undefined,
				nullValue: null,
				config: {
					value: undefined,
					enabled: true,
					nested: ["draft", null, 1],
				},
			}),
		).rejects.toThrow();
	});
});
