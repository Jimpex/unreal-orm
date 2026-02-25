#!/usr/bin/env node
import { Command } from "@commander-js/extra-typings";
import { initCommand } from "./commands/init";
import { pullCommand } from "./commands/pull";
import { pushCommand } from "./commands/push";
import { diffCommand } from "./commands/diff";
import { mermaidCommand } from "./commands/mermaid";
import { githubCommand } from "./commands/github";
import { docsCommand } from "./commands/docs";
import { viewCommand } from "./commands/view";
import { CLI_VERSION, checkForUpdates } from "./utils/version";
import { setLogLevel, isSilent, type LogLevel } from "./utils/logLevel";
import { debug } from "./utils/debug";

const program = new Command()
	.name("unreal")
	.description("UnrealORM CLI for SurrealDB")
	.version(CLI_VERSION)
	.hook("preAction", (_thisCommand, actionCommand) => {
		const level = actionCommand.getOptionValue("logLevel") as
			| LogLevel
			| undefined;
		if (level) setLogLevel(level);
		debug("Debug logging enabled");
	})
	.hook("postAction", async () => {
		if (!isSilent()) {
			await checkForUpdates();
		}
		// Force exit: @surrealdb/node native engine holds event loop handles
		// after db.close(), preventing natural process termination
		process.exit(0);
	});

program.addCommand(initCommand);
program.addCommand(pullCommand);
program.addCommand(pushCommand);
program.addCommand(diffCommand);
program.addCommand(mermaidCommand);
program.addCommand(docsCommand);
program.addCommand(viewCommand);
program.addCommand(githubCommand);

program.parse();
