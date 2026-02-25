import { type ConnectOptions, createRemoteEngines, Surreal } from "surrealdb";
import { createNodeEngines } from "@surrealdb/node";

const remoteConfig: ConnectOptions & { url: string } = {
	url: "http://localhost:8001",
	authentication: { username: "root", password: "root" },
};

let hasLoggedSetup = false;

export async function setupInMemoryDb(namespace = "test", database = "test") {
	const db = new Surreal({
		engines: {
			// ...createRemoteEngines(),
			...createNodeEngines(),
		},
	});
	const useRemote = process.env.TEST_MODE === "remote";

	if (useRemote) {
		await db
			.connect(remoteConfig.url, remoteConfig)
			.then(() => {
				if (!hasLoggedSetup) console.log("Connected to remote database");
			})
			.catch((error) => {
				console.log("Failed to connect to remote database");
				console.log(error);
			});
	} else {
		await db
			.connect("mem://")
			.then(() => {
				if (!hasLoggedSetup) console.log("Connected to in-memory database");
			})
			.catch((error) => {
				console.log("Failed to connect to in-memory database");
				console.log(error);
			});
	}

	if (!hasLoggedSetup) {
		const version = await db.version();
		console.log(
			`\x1b[32m\x1b[1mSurrealDB version: \x1b[0m\x1b[0m ${version.version}`,
		);
		console.log(
			`\x1b[34m\x1b[1mTest Mode:         \x1b[0m\x1b[0m ${
				useRemote ? `Remote (${remoteConfig.url})` : "In-Memory"
			}`,
		);
		hasLoggedSetup = true;
	}

	await db.use({ namespace, database });
	return db;
}

export async function teardownDb(db: Surreal) {
	try {
		await db.close();
	} catch {}
}
