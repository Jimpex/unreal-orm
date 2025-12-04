#!/usr/bin/env tsx
/**
 * generate-cli-docs.ts
 * Generates markdown documentation for CLI commands from Commander.js definitions.
 * Run with: pnpm run generate-cli-docs
 */

import { join, dirname, relative } from "node:path";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import type { Command, Option } from "@commander-js/extra-typings";

// Get current script directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const PATHS = {
	REPO_ROOT: join(__dirname, "../../.."),
	CLI_COMMANDS: join(__dirname, "../../../packages/unreal-cli/src/commands"),
	CLI_DOCS_OUTPUT: join(__dirname, "../src/content/docs/cli"),
};

interface CommandInfo {
	name: string;
	description: string;
	options: OptionInfo[];
	arguments: ArgumentInfo[];
	aliases: string[];
}

interface OptionInfo {
	flags: string;
	description: string;
	defaultValue?: string;
	required: boolean;
}

interface ArgumentInfo {
	name: string;
	description: string;
	required: boolean;
	defaultValue?: string;
}

/**
 * Extract command information from a Commander Command object
 */
function extractCommandInfo(cmd: Command): CommandInfo {
	const options: OptionInfo[] = [];

	// Extract options
	for (const opt of cmd.options as Option[]) {
		options.push({
			flags: opt.flags,
			description: opt.description || "",
			defaultValue:
				opt.defaultValue !== undefined ? String(opt.defaultValue) : undefined,
			required: opt.required || false,
		});
	}

	// Extract arguments
	const args: ArgumentInfo[] = [];
	// Commander stores arguments in _args (internal)
	const cmdArgs =
		(
			cmd as unknown as {
				registeredArguments?: Array<{
					name: () => string;
					description: string;
					required: boolean;
					defaultValue?: unknown;
				}>;
			}
		).registeredArguments || [];
	for (const arg of cmdArgs) {
		args.push({
			name: arg.name(),
			description: arg.description || "",
			required: arg.required,
			defaultValue:
				arg.defaultValue !== undefined ? String(arg.defaultValue) : undefined,
		});
	}

	return {
		name: cmd.name(),
		description: cmd.description(),
		options,
		arguments: args,
		aliases: cmd.aliases(),
	};
}

/**
 * Generate markdown documentation for a command
 */
function generateCommandMarkdown(info: CommandInfo, order: number): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push(`title: "unreal ${info.name}"`);
	lines.push(`description: "${info.description.replace(/"/g, '\\"')}"`);
	lines.push("sidebar:");
	lines.push(`  order: ${order}`);
	lines.push("---");
	lines.push("");

	// Description
	lines.push(info.description);
	lines.push("");

	// Usage
	lines.push("## Usage");
	lines.push("");
	const argsStr = info.arguments
		.map((a) => (a.required ? `<${a.name}>` : `[${a.name}]`))
		.join(" ");
	const hasOptions = info.options.length > 0;
	lines.push("```bash");
	lines.push(
		`unreal ${info.name}${argsStr ? ` ${argsStr}` : ""}${hasOptions ? " [options]" : ""}`,
	);
	lines.push("```");
	lines.push("");

	// Aliases
	if (info.aliases.length > 0) {
		lines.push("## Aliases");
		lines.push("");
		lines.push(info.aliases.map((a) => `\`${a}\``).join(", "));
		lines.push("");
	}

	// Arguments
	if (info.arguments.length > 0) {
		lines.push("## Arguments");
		lines.push("");
		lines.push("| Argument | Description | Required | Default |");
		lines.push("|----------|-------------|----------|---------|");
		for (const arg of info.arguments) {
			const req = arg.required ? "Yes" : "No";
			const def = arg.defaultValue ?? "-";
			lines.push(`| \`${arg.name}\` | ${arg.description} | ${req} | ${def} |`);
		}
		lines.push("");
	}

	// Options
	if (info.options.length > 0) {
		lines.push("## Options");
		lines.push("");
		lines.push("| Option | Description | Default |");
		lines.push("|--------|-------------|---------|");
		for (const opt of info.options) {
			const def = opt.defaultValue ?? "-";
			// Escape pipes in flags
			const flags = opt.flags.replace(/\|/g, "\\|");
			lines.push(`| \`${flags}\` | ${opt.description} | ${def} |`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Generate index page for CLI documentation
 */
function generateIndexMarkdown(commands: CommandInfo[]): string {
	const lines: string[] = [];

	lines.push("---");
	lines.push('title: "CLI Reference"');
	lines.push('description: "Command-line interface for UnrealORM"');
	lines.push("sidebar:");
	lines.push("  order: 0");
	lines.push("---");
	lines.push("");
	lines.push(
		"The UnrealORM CLI provides commands for managing your SurrealDB schema and database.",
	);
	lines.push("");
	lines.push("## Installation");
	lines.push("");
	lines.push("```bash");
	lines.push("# npm");
	lines.push("npm install -g unreal-orm");
	lines.push("");
	lines.push("# pnpm");
	lines.push("pnpm add -g unreal-orm");
	lines.push("");
	lines.push("# bun");
	lines.push("bun add -g unreal-orm");
	lines.push("```");
	lines.push("");
	lines.push("## Commands");
	lines.push("");
	lines.push("| Command | Description |");
	lines.push("|---------|-------------|");
	for (const cmd of commands) {
		lines.push(
			`| [\`unreal ${cmd.name}\`](/cli/${cmd.name}/) | ${cmd.description} |`,
		);
	}
	lines.push("");
	lines.push("## Global Options");
	lines.push("");
	lines.push("All commands support the following global options:");
	lines.push("");
	lines.push("```bash");
	lines.push("unreal --version  # Show version number");
	lines.push("unreal --help     # Show help");
	lines.push("```");
	lines.push("");

	return lines.join("\n");
}

/**
 * Dynamically import all command files and extract their exports
 */
async function loadCommands(): Promise<Command[]> {
	const commands: Command[] = [];
	const commandFiles = readdirSync(PATHS.CLI_COMMANDS);

	for (const file of commandFiles) {
		// Handle both files and directories (like view/)
		const fullPath = join(PATHS.CLI_COMMANDS, file);
		let modulePath: string;

		if (file.endsWith(".ts") && !file.startsWith("_")) {
			modulePath = fullPath;
		} else if (existsSync(join(fullPath, "index.ts"))) {
			modulePath = join(fullPath, "index.ts");
		} else {
			continue;
		}

		try {
			const module = await import(modulePath);
			// Find exported Command objects
			for (const [key, value] of Object.entries(module)) {
				if (
					key.endsWith("Command") &&
					value &&
					typeof (value as Command).name === "function"
				) {
					commands.push(value as Command);
				}
			}
		} catch (error) {
			console.warn(chalk.yellow(`⚠ Could not load ${file}: ${error}`));
		}
	}

	return commands;
}

/**
 * Main function
 */
async function main(): Promise<void> {
	console.log(chalk.blue("📚 Generating CLI documentation..."));

	// Ensure output directory exists
	if (!existsSync(PATHS.CLI_DOCS_OUTPUT)) {
		mkdirSync(PATHS.CLI_DOCS_OUTPUT, { recursive: true });
		console.log(
			chalk.green(
				`✓ Created directory: ${relative(PATHS.REPO_ROOT, PATHS.CLI_DOCS_OUTPUT)}`,
			),
		);
	}

	// Load all commands
	const commands = await loadCommands();
	console.log(chalk.cyan(`  Found ${commands.length} commands`));

	// Sort commands alphabetically
	commands.sort((a, b) => a.name().localeCompare(b.name()));

	// Extract info and generate docs
	const commandInfos: CommandInfo[] = [];
	let order = 1;

	for (const cmd of commands) {
		const info = extractCommandInfo(cmd);
		commandInfos.push(info);

		const markdown = generateCommandMarkdown(info, order++);
		const outputPath = join(PATHS.CLI_DOCS_OUTPUT, `${info.name}.md`);
		writeFileSync(outputPath, markdown);
		console.log(chalk.green(`✓ Generated ${info.name}.md`));
	}

	// Generate index page
	const indexMarkdown = generateIndexMarkdown(commandInfos);
	const indexPath = join(PATHS.CLI_DOCS_OUTPUT, "index.md");
	writeFileSync(indexPath, indexMarkdown);
	console.log(chalk.green("✓ Generated index.md"));

	console.log(
		chalk.blue(`\n✨ Generated documentation for ${commands.length} commands!`),
	);
}

main().catch(console.error);
