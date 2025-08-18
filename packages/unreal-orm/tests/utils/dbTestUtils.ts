import { Surreal } from "surrealdb";
import { surrealdbNodeEngines } from "@surrealdb/node";

export async function setupInMemoryDb(namespace = "test", database = "test") {
	const db = new Surreal({ engines: surrealdbNodeEngines() });
	await db.connect("mem://");
	await db.use({ namespace, database });
	return db;
}

export async function teardownDb(db: Surreal) {
	try {
		await db.close();
	} catch {}
}
