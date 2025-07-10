// Tests for SurrealQL DDL generation, schemafull, permissions, indexes

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { applySchema, generateTableSchemaQl } from "../../src/schemaGenerator";
import type Surreal from "surrealdb";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("relation_hydration", "relation_hydration");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("DDL Generation", () => {
	test("generates and applies schemafull normal table DDL", async () => {
		class User extends Table.normal({
			name: "userddl",
			fields: {
				name: Field.string(),
				age: Field.number(),
				email: Field.string(),
			},
			schemafull: true,
			permissions: {
				select: "FULL",
				create: "FULL",
				update: "NONE",
				delete: "NONE",
			},
			indexes: [
				{ name: "idx_userddl_email", fields: ["email"], unique: true },
				{ name: "idx_userddl_name_age", fields: ["name", "age"] },
			],
		}) {}
		const ddl = generateTableSchemaQl(User);
		expect(ddl).toContain("DEFINE TABLE userddl SCHEMAFULL");
		expect(ddl).toContain("DEFINE FIELD name ON TABLE userddl TYPE string");
		expect(ddl).toContain("DEFINE FIELD age ON TABLE userddl TYPE number");
		expect(ddl).toContain(
			"PERMISSIONS FOR select FULL, FOR create FULL, FOR update NONE, FOR delete NONE",
		);
		expect(ddl).toContain("DEFINE INDEX idx_userddl_email");
		expect(ddl).toContain("UNIQUE");
		expect(ddl).toContain("DEFINE INDEX idx_userddl_name_age");

		await applySchema(db, [User]);
	});

	test("generates and applies schemaflex table DDL", async () => {
		class Flex extends Table.normal({
			name: "flexddl",
			fields: { foo: Field.string() },
			schemafull: false,
		}) {}
		const ddl = generateTableSchemaQl(Flex);
		expect(ddl).toContain("DEFINE TABLE flexddl SCHEMALESS");
		expect(ddl).toContain("DEFINE FIELD foo ON TABLE flexddl TYPE string");
		await applySchema(db, [Flex]);
	});

	test("generates and applies relation table DDL", async () => {
		class User extends Table.normal({
			name: "userrel",
			fields: { name: Field.string() },
			schemafull: true,
		}) {}
		class Post extends Table.normal({
			name: "postrel",
			fields: { title: Field.string() },
			schemafull: true,
		}) {}
		class Authored extends Table.relation({
			name: "authoredrel",
			fields: {
				in: Field.record(() => User),
				out: Field.record(() => Post),
				since: Field.datetime(),
			},
			schemafull: true,
		}) {}
		const ddl = generateTableSchemaQl(Authored);
		expect(ddl).toContain("DEFINE TABLE authoredrel SCHEMAFULL");
		expect(ddl).toContain(
			"DEFINE FIELD in ON TABLE authoredrel TYPE record<userrel>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD out ON TABLE authoredrel TYPE record<postrel>",
		);
		expect(ddl).toContain(
			"DEFINE FIELD since ON TABLE authoredrel TYPE datetime",
		);
		await applySchema(db, [User, Post, Authored]);
	});
});
