import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createRemoteEngines, Surreal } from "surrealdb";
import { createNodeEngines } from "@surrealdb/node";
import { Table, Field, Index, applySchema } from "unreal-orm";
import { introspect } from "../../src/introspection/introspect";
import { compareSchemas } from "../../src/diff/compare";
import { extractTableFromModel } from "../../src/diff/parseTypeScript";
import type { SchemaAST } from "../../src/introspection/types";

describe("Diff Command Integration", () => {
	let db: Surreal;

	beforeAll(async () => {
		// Setup DB with Node engines
		db = new Surreal({
			engines: {
				...createRemoteEngines(),
				...createNodeEngines(),
			},
		});
		await db.connect("mem://");
		await db.use({ namespace: "test", database: "test" });
	});

	afterAll(async () => {
		await db.close();
	});

	test("should detect no changes when schema is identical", async () => {
		// 1. Define schema using actual Table/Field/Index classes
		class User extends Table.normal({
			name: "user",
			fields: {
				name: Field.string(),
				email: Field.string(),
			},
			schemafull: true,
		}) {}

		const idx_email = Index.define(() => User, {
			name: "idx_email",
			fields: ["email"],
			unique: true,
		});

		// 2. Apply schema to DB
		await applySchema(db, [User, idx_email]);

		// 3. Introspect DB (Remote)
		const remoteSchema = await introspect(db);

		// 4. Build local schema from the same model classes
		const userTable = extractTableFromModel(User);
		// Manually add index (Index.define returns runtime format, we need AST format)
		userTable.indexes.push({
			name: idx_email.name,
			columns: idx_email.fields,
			unique: idx_email.unique ?? false,
		});

		const localSchema: SchemaAST = {
			tables: [userTable],
		};

		// 5. Compare
		const changes = compareSchemas(remoteSchema, localSchema);

		// Should be 0 changes
		expect(changes).toHaveLength(0);
	});

	test("should detect field added in DB", async () => {
		// Define initial schema
		class User extends Table.normal({
			name: "user2",
			fields: {
				name: Field.string(),
				email: Field.string(),
			},
			schemafull: true,
		}) {}

		await applySchema(db, [User]);

		// Add field directly to DB (simulating drift)
		await db.query("DEFINE FIELD age ON TABLE user2 TYPE number;");

		const remoteSchema = await introspect(db);
		const localSchema: SchemaAST = {
			tables: [extractTableFromModel(User)],
		};
		const changes = compareSchemas(remoteSchema, localSchema);

		// Find the specific change we care about
		const ageAdded = changes.find(
			(c) => c.type === "field_added" && c.field === "age",
		);
		expect(ageAdded).toBeDefined();
		expect(ageAdded?.table).toBe("user2");
	});

	test("should detect field removed in DB (exists locally)", async () => {
		// Define schema with 'bio' field
		class User extends Table.normal({
			name: "user3",
			fields: {
				name: Field.string(),
				email: Field.string(),
				bio: Field.string(),
			},
			schemafull: true,
		}) {}

		// Apply schema WITHOUT 'bio' to DB
		await db.query(`
			DEFINE TABLE user3 SCHEMAFULL;
			DEFINE FIELD name ON TABLE user3 TYPE string;
			DEFINE FIELD email ON TABLE user3 TYPE string;
		`);

		const remoteSchema = await introspect(db);
		const localSchema: SchemaAST = {
			tables: [extractTableFromModel(User)],
		};
		const changes = compareSchemas(remoteSchema, localSchema);

		// 'bio' exists locally but not in DB
		const removed = changes.find(
			(c) => c.type === "field_removed" && c.field === "bio",
		);
		expect(removed).toBeDefined();
	});
});
