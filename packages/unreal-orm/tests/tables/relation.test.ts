import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field, Table, applySchema } from "../../src";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import { RecordId, type Surreal } from "surrealdb";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("relation_table", "relation_table");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Table.relation (edge table) behavior", () => {
	// Minimal node models
	class User extends Table.normal({
		name: "user",
		fields: { name: Field.string() },
		schemafull: true,
	}) {}
	class Group extends Table.normal({
		name: "group",
		fields: { label: Field.string() },
		schemafull: true,
	}) {}

	// Edge model via Table.relation
	class MemberOf extends Table.relation({
		name: "member_of",
		fields: {
			in: Field.record(() => User),
			out: Field.record(() => Group),
			joined: Field.datetime(),
			role: Field.option(Field.string()),
		},
		schemafull: true,
	}) {}

	test("apply schema", async () => {
		await applySchema(db, [User, Group, MemberOf], "OVERWRITE");
	});

	test("relation table: create edge with required in/out", async () => {
		const user = await User.create(db, { name: "Alice" });
		const group = await Group.create(db, { label: "Chess Club" });
		const edge = await MemberOf.create(db, {
			in: user.id,
			out: group.id,
			joined: new Date(),
			role: "admin",
		});
		expect(edge.in.toString()).toBe(user.id.toString());
		expect(edge.out.toString()).toBe(group.id.toString());
		expect(edge.role).toBe("admin");
	});

	test("relation table: missing in/out throws", async () => {
		const user = await User.create(db, { name: "Bob" });
		expect(
			MemberOf.create(db, { in: user.id, joined: new Date() }),
		).rejects.toThrow();
		expect(
			MemberOf.create(db, { out: user.id, joined: new Date() }),
		).rejects.toThrow();
	});

	test("relation table: can select by in/out", async () => {
		const user = await User.create(db, { name: "Carol" });
		const group = await Group.create(db, { label: "Book Club" });
		await MemberOf.create(db, {
			in: user.id,
			out: group.id,
			joined: new Date(),
		});
		const found = await MemberOf.select(db, {
			where: "in = $id",
			vars: { id: user.id },
		});
		expect(found.length).toBeGreaterThan(0);
		expect(found[0]?.in.toString()).toBe(user.id.toString());
		expect(found[0]?.out.toString()).toBe(group.id.toString());
	});

	test("relation table: instance typing and $dynamic", async () => {
		const user = await User.create(db, { name: "Dora" });
		const group = await Group.create(db, { label: "Math Club" });
		const edge = await MemberOf.create(db, {
			in: user.id,
			out: group.id,
			joined: new Date(),
		});
		// $dynamic should exist and be an object
		expect(typeof edge.$dynamic).toBe("object");
		// Edge instance should have id and all fields
		expect(edge).toHaveProperty("id");
		expect(edge).toHaveProperty("in");
		expect(edge).toHaveProperty("out");
		expect(edge).toHaveProperty("joined");
	});

	test("relation table: invalid references throw", async () => {
		const fakeUser = new RecordId("user", "notreal");
		const fakeGroup = new RecordId("group", "notreal");
		expect(
			MemberOf.create(db, {
				in: fakeUser,
				out: fakeGroup,
				joined: new Date(),
			}),
		).resolves.toThrow();
	});
});
