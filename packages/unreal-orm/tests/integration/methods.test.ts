import { test, describe, expect, beforeAll, afterAll } from "bun:test";
import { Field } from "../../src/fields";
import Table from "../../src/define";
import { setupInMemoryDb, teardownDb } from "../utils/dbTestUtils";
import type { Surreal } from "surrealdb";
import { applySchema } from "../../src";

let db: Surreal;

beforeAll(async () => {
	db = await setupInMemoryDb("methods", "methods");
});
afterAll(async () => {
	await teardownDb(db);
});

describe("Model Methods (Instance & Static)", () => {
	class User extends Table.normal({
		name: "user",
		fields: {
			name: Field.string(),
			age: Field.number(),
		},
		schemafull: true,
	}) {
		getDisplayName(): string {
			return `${this.name} (${this.age})`;
		}
		haveBirthday(): void {
			this.age++;
		}
		static findByName(db: Surreal, name: string) {
			return this.select(db, { where: "name = $name", vars: { name } });
		}
		static platformName(): string {
			return "UnrealORM";
		}
	}

	test("apply schema", async () => {
		await applySchema(db, [User]);
	});

	test("instance method: getDisplayName()", async () => {
		const user = await User.create(db, { name: "Alice", age: 30 });
		expect(user.getDisplayName()).toBe("Alice (30)");
	});

	test("instance method: haveBirthday()", async () => {
		const user = await User.create(db, { name: "Bob", age: 25 });
		user.haveBirthday();
		expect(user.age).toBe(26);
	});

	test("static method: findByName()", async () => {
		await User.create(db, { name: "Carol", age: 40 });
		const found = await User.findByName(db, "Carol");
		expect(found.length).toBeGreaterThanOrEqual(1);
		expect(found[0]?.name).toBe("Carol");
	});

	test("static method: platformName()", () => {
		expect(User.platformName()).toBe("UnrealORM");
	});

	test("methods: this typing and field access", async () => {
		const user = await User.create(db, { name: "Dana", age: 22 });
		expect(user.getDisplayName()).toContain(user.name);
		user.haveBirthday();
		expect(user.age).toBe(23);
	});

	// Inheritance/override example
	class AdminUser extends User {
		override getDisplayName(): string {
			return `ADMIN: ${this.name}`;
		}
		static override platformName(): string {
			return "UnrealORM-Admin";
		}
	}

	test("override instance/static methods", async () => {
		const admin = await AdminUser.create(db, { name: "Eve", age: 50 });
		expect(admin.getDisplayName()).toBe("ADMIN: Eve");
		expect(AdminUser.platformName()).toBe("UnrealORM-Admin");
	});
});
