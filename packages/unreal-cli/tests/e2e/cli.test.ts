/**
 * End-to-End CLI Tests
 *
 * These tests run the actual CLI commands and verify their behavior.
 * Each CLI invocation creates its own in-memory DB, so tests verify
 * command output and generated files rather than shared DB state.
 *
 * Note: Tests that require importing TypeScript schema files use the examples directory
 * which has proper package resolution.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { $ } from "bun";

// Path to the CLI entry point
const CLI_PATH = join(import.meta.dir, "../../src/index.ts");
// Path to examples directory (has proper package resolution)
const EXAMPLES_DIR = join(import.meta.dir, "../../examples/simple");

describe("CLI E2E Tests", () => {
	let testDir: string;

	beforeEach(async () => {
		// Create fresh temp directory for each test
		testDir = await mkdtemp(join(tmpdir(), "unreal-cli-test-"));

		// Create minimal config
		await writeFile(
			join(testDir, "unreal.config.json"),
			JSON.stringify({ path: "./unreal" }),
		);

		// Create tables directory
		await mkdir(join(testDir, "unreal", "tables"), { recursive: true });
	});

	describe("pull command", () => {
		test("should handle empty database gracefully", async () => {
			const result =
				await $`bun run ${CLI_PATH} pull --log-level silent --embedded memory -n test -d test -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);
		});

		test("should show proper output messages", async () => {
			const result =
				await $`bun run ${CLI_PATH} pull --embedded memory -n test -d test -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.quiet()
					.nothrow();

			const output = result.stdout.toString();
			expect(output).toContain("UnrealORM Pull");
			expect(output).toContain("up to date");
		});
	});

	describe("push command", () => {
		test("should apply TypeScript schema to database using examples", async () => {
			const result =
				await $`bun run ${CLI_PATH} push --log-level silent --embedded memory -n test -d test -s ${EXAMPLES_DIR} -y`
					.cwd(join(import.meta.dir, "../.."))
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);
		});

		test("should fail gracefully when schema directory doesn't exist", async () => {
			const result =
				await $`bun run ${CLI_PATH} push --log-level silent --embedded memory -n test -d test -s ${join(testDir, "nonexistent")} -y`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.exitCode).not.toBe(0);
			const allOutput = result.stdout.toString() + result.stderr.toString();
			expect(allOutput).toContain("not found");
		});
	});

	describe("diff command", () => {
		test("should work with examples directory", async () => {
			const result =
				await $`bun run ${CLI_PATH} diff --log-level silent --embedded memory -n test -d test -s ${EXAMPLES_DIR}`
					.cwd(join(import.meta.dir, "../.."))
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);
		});
	});

	describe("mermaid command", () => {
		test("should generate mermaid diagram from code using examples", async () => {
			const outputPath = join(testDir, "schema.mermaid");

			const result =
				await $`bun run ${CLI_PATH} mermaid --log-level silent --code -s ${EXAMPLES_DIR} -o ${outputPath}`
					.cwd(join(import.meta.dir, "../.."))
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);

			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
			expect(mermaidContent).toContain("user");
		});

		test("should generate mermaid diagram from database (empty)", async () => {
			const outputPath = join(testDir, "db-schema.mermaid");

			const result =
				await $`bun run ${CLI_PATH} mermaid --log-level silent --db --embedded memory -n test -d test -o ${outputPath}`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);

			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
		});

		test("should output to stdout with --stdout flag", async () => {
			const result =
				await $`bun run ${CLI_PATH} mermaid --log-level silent --db --embedded memory -n test -d test --stdout`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("erDiagram");
		});

		test("should generate from .surql file", async () => {
			const surqlContent = `
DEFINE TABLE category SCHEMAFULL;
DEFINE FIELD name ON TABLE category TYPE string;
DEFINE FIELD slug ON TABLE category TYPE string;
`;
			const surqlPath = join(testDir, "schema.surql");
			await writeFile(surqlPath, surqlContent);

			const outputPath = join(testDir, "from-surql.mermaid");

			const result =
				await $`bun run ${CLI_PATH} mermaid --log-level silent --surql ${surqlPath} -o ${outputPath}`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.exitCode).toBe(0);

			const mermaidContent = await readFile(outputPath, "utf-8");
			expect(mermaidContent).toContain("erDiagram");
			expect(mermaidContent).toContain("category");
		});
	});

	describe("CLI flags", () => {
		test("init command pins current surrealdb dependency version in generated deps", async () => {
			const initSource = await readFile(
				join(import.meta.dir, "../../src/commands/init.ts"),
				"utf-8",
			);
			expect(initSource).toContain('"surrealdb@2.0.3"');
			expect(initSource).toContain('"@surrealdb/node@3.0.3"');
		});

		test("should accept all connection flags", async () => {
			const result =
				await $`bun run ${CLI_PATH} pull --log-level silent --embedded memory -u root -p root -n test -d test --auth-level root -s ${join(testDir, "unreal/tables")} -y`
					.cwd(testDir)
					.quiet()
					.nothrow();

			expect(result.stderr.toString()).not.toContain("unknown option");
		});

		test("should show help with --help flag", async () => {
			const result = await $`bun run ${CLI_PATH} --help`
				.cwd(testDir)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("UnrealORM CLI");
			expect(result.stdout.toString()).toContain("pull");
			expect(result.stdout.toString()).toContain("push");
			expect(result.stdout.toString()).toContain("diff");
			expect(result.stdout.toString()).toContain("mermaid");
		});

		test("should show command help with command --help", async () => {
			const result = await $`bun run ${CLI_PATH} pull --help`
				.cwd(testDir)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toContain("--schema-dir");
			expect(result.stdout.toString()).toContain("--url");
			expect(result.stdout.toString()).toContain("--log-level");
		});

		test("should show version with --version flag", async () => {
			const result = await $`bun run ${CLI_PATH} --version`
				.cwd(testDir)
				.quiet()
				.nothrow();

			expect(result.exitCode).toBe(0);
			expect(result.stdout.toString()).toMatch(/\d+\.\d+\.\d+/);
		});
	});
});
