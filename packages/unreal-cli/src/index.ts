#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { initCommand } from "./commands/init";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { diffCommand } from "./commands/diff";
import { mermaidCommand } from "./commands/mermaid";
import { githubCommand } from "./commands/github";
import { docsCommand } from "./commands/docs";
import { CLI_VERSION, checkForUpdates } from "./utils/version";

const program = new Command()
	.name("unreal")
	.description("UnrealORM CLI for SurrealDB")
	.version(CLI_VERSION)
	.hook("postAction", async () => {
		// Check for updates after command completes (non-blocking)
		await checkForUpdates();
	});

program.addCommand(initCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);
program.addCommand(diffCommand);
program.addCommand(mermaidCommand);
program.addCommand(docsCommand);
program.addCommand(githubCommand);

program.parse();
