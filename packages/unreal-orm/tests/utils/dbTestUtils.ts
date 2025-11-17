import { createRemoteEngines, Surreal } from "surrealdb";
import { createNodeEngines } from "@surrealdb/node";

export async function setupInMemoryDb(namespace = "test", database = "test") {
	const db = new Surreal({
		engines: { ...createRemoteEngines(), ...createNodeEngines() },
	});
	await db.connect("mem://");
	// await db.connect("http://localhost:8001", {
	// 	authentication: { username: "root", password: "root" },
	// });

	const version = await db.version();
	// Log version with color and boldened text
	console.log(
		`\x1b[32m\x1b[1mSurrealDB version: \x1b[0m\x1b[0m ${version.version}`,
	);

	await db.use({ namespace, database });
	return db;
}

export async function teardownDb(db: Surreal) {
	try {
		await db.close();
	} catch {}
}
