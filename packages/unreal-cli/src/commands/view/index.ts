import { Command } from "@commander-js/extra-typings";
import { resolveConnection } from "../../utils/connect";
import { loadConfig } from "../../utils/config";
import { ui } from "../../utils/ui";
import type { ViewState } from "./types";
import {
	HIDE_CURSOR,
	SHOW_CURSOR,
	enterAltScreen,
	exitAltScreen,
} from "./terminal";
import { tableListView } from "./tableListView";

// Constants
const DEFAULT_PAGE_SIZE = 15;
const MIN_PAGE_SIZE = 5;
const MAX_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT = 3;
const DEFAULT_CONCURRENCY = 5;

export const viewCommand = new Command("view")
	.description("Interactive TUI for browsing database tables and records")
	.option("--url <url>", "Database URL")
	.option("-u, --username <username>", "Database username")
	.option("-p, --password <password>", "Database password")
	.option("-n, --namespace <namespace>", "Database namespace")
	.option("-d, --database <database>", "Database name")
	.option(
		"--auth-level <level>",
		"Authentication level (root, namespace, database)",
	)
	.option("-e, --embedded <mode>", "Use embedded mode (memory or file path)")
	.option(
		"--page-size <size>",
		`Records per page (${MIN_PAGE_SIZE}-${MAX_PAGE_SIZE}, default: auto)`,
	)
	.option(
		"--timeout <seconds>",
		`Query timeout in seconds (default: ${DEFAULT_TIMEOUT})`,
	)
	.option(
		"--concurrency <count>",
		`Max concurrent count queries (default: ${DEFAULT_CONCURRENCY})`,
	)
	.action(async (options) => {
		ui.header("Database Viewer", "Interactive table browser");

		const config = await loadConfig();
		const db = await resolveConnection({
			cliOptions: {
				url: options.url,
				username: options.username,
				password: options.password,
				namespace: options.namespace,
				database: options.database,
				authLevel: options.authLevel,
				embedded: options.embedded,
			},
			config,
			skipAutoConfig: true,
		});

		if (!db) return;

		// Calculate page size based on terminal height or user option
		const terminalHeight = process.stdout.rows || 24;
		let pageSize = DEFAULT_PAGE_SIZE;

		if (options.pageSize) {
			const parsed = Number.parseInt(options.pageSize, 10);
			if (!Number.isNaN(parsed)) {
				pageSize = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, parsed));
			}
		} else {
			// Auto-calculate: terminal height minus header/footer/chrome (~10 lines)
			pageSize = Math.max(MIN_PAGE_SIZE, Math.min(terminalHeight - 10, 30));
		}

		// Parse timeout and concurrency
		const timeout = options.timeout
			? Math.max(1, Number.parseInt(options.timeout, 10) || DEFAULT_TIMEOUT)
			: DEFAULT_TIMEOUT;
		const concurrency = options.concurrency
			? Math.max(
					1,
					Number.parseInt(options.concurrency, 10) || DEFAULT_CONCURRENCY,
				)
			: DEFAULT_CONCURRENCY;

		const state: ViewState = {
			db,
			pageSize,
			terminalHeight,
			timeout,
			concurrency,
		};

		// Enter alternate screen buffer and hide cursor
		enterAltScreen();
		process.stdout.write(HIDE_CURSOR);

		try {
			await tableListView(state);
		} catch (error) {
			if (error instanceof Error && error.message === "EXIT") {
				// Clean exit
			} else {
				// Exit alt screen before showing error in main terminal
				process.stdout.write(SHOW_CURSOR);
				exitAltScreen();
				ui.error(error instanceof Error ? error.message : String(error));
				await db.close();
				return;
			}
		}

		// Restore cursor and exit alternate screen
		process.stdout.write(SHOW_CURSOR);
		exitAltScreen();
		await db.close();
	});
