import type { Surreal } from "surrealdb";
import type { TableInfo, ViewState } from "./types";
import { theme } from "./theme";
import { clearScreen, softRefresh, readKey, readLine } from "./terminal";
import { renderHeader } from "./render";
import { formatCount } from "./format";
import { recordsView } from "./recordsView";

/**
 * Fetch table count with timeout
 */
async function fetchCountWithTimeout(
	db: Surreal,
	tableName: string,
	timeoutSec: number,
): Promise<number | "timeout"> {
	return db
		.query(
			`SELECT count() FROM \`${tableName}\` GROUP ALL TIMEOUT ${timeoutSec}s`,
		)
		.collect<[{ count: number }[]]>()
		.then((response) => response[0]?.[0]?.count ?? "timeout")
		.catch(() => "timeout");
}

/**
 * Fetch counts for multiple tables with controlled concurrency
 */
async function fetchCountsConcurrently(
	db: Surreal,
	tables: TableInfo[],
	timeoutSec: number,
	concurrency: number,
	onUpdate: () => void,
): Promise<void> {
	let index = 0;

	const fetchNext = async (): Promise<void> => {
		while (index < tables.length) {
			const currentIndex = index++;
			const table = tables[currentIndex];
			if (!table) continue;

			table.count = await fetchCountWithTimeout(db, table.name, timeoutSec);
			onUpdate();
		}
	};

	// Start concurrent workers
	const workers = Array.from(
		{ length: Math.min(concurrency, tables.length) },
		() => fetchNext(),
	);
	await Promise.all(workers);
}

/**
 * Table list view - shows all tables with counts
 */
export async function tableListView(state: ViewState): Promise<void> {
	let selectedIndex = 0;
	let tables: TableInfo[] = [];
	let filteredTables: TableInfo[] = [];
	let loading = true;
	let filter = "";

	// Initial load
	const loadTables = async () => {
		loading = true;
		render(true); // Full clear on initial load

		const [results] = await state.db.query("INFO FOR DB").collect();
		const info = results as { tables: Record<string, string> };

		if (!info?.tables) {
			throw new Error("Failed to retrieve database info");
		}

		const tableNames = Object.keys(info.tables).sort();
		tables = tableNames.map((name) => ({ name, count: "?" as const }));
		filteredTables = tables;
		loading = false;
		render();

		// Fetch counts concurrently
		await fetchCountsConcurrently(
			state.db,
			tables,
			state.timeout,
			state.concurrency,
			render,
		);
	};

	const render = (full = false) => {
		if (full) {
			clearScreen();
		} else {
			softRefresh();
		}

		// Calculate visible range based on current terminal height
		// Chrome: header(2) + separator(1) + footer(1) = 4 lines
		const termHeight = process.stdout.rows || 24;
		const maxVisible = Math.max(5, termHeight - 4);

		const filterText = filter
			? ` ${theme.highlight(`[filter: ${filter}]`)}`
			: "";
		renderHeader(`Tables${filterText}`, `${filteredTables.length} tables`);

		if (loading) {
			console.log(theme.dim("  Loading tables..."));
			return;
		}

		if (filteredTables.length === 0) {
			if (filter) {
				console.log(theme.warning(`  No tables matching "${filter}"`));
				console.log(theme.dim("  Press Esc to clear filter"));
			} else {
				console.log(theme.warning("  No tables found in database."));
			}
			return;
		}

		let startIdx = 0;
		if (selectedIndex >= maxVisible) {
			startIdx = selectedIndex - maxVisible + 1;
		}
		const endIdx = Math.min(startIdx + maxVisible, filteredTables.length);

		for (let i = startIdx; i < endIdx; i++) {
			const table = filteredTables[i];
			if (!table) continue;
			const isSelected = i === selectedIndex;
			const prefix = isSelected ? theme.primary("▸ ") : "  ";
			const name = isSelected ? theme.primary.bold(table.name) : table.name;
			const count = formatCount(table.count);
			console.log(
				`${prefix}${name} ${theme.dim("(")}${count}${theme.dim(")")}`,
			);
		}

		// Single line footer with position info
		const posInfo =
			filteredTables.length > maxVisible
				? `${startIdx + 1}-${endIdx}/${filteredTables.length} • `
				: "";
		console.log(
			theme.dim(
				`  ${posInfo}↑↓ nav • Enter select • / filter • r refresh • q quit`,
			),
		);
	};

	await loadTables();

	if (filteredTables.length === 0 && !filter) {
		await readKey();
		return;
	}

	const applyFilter = () => {
		if (filter) {
			const lowerFilter = filter.toLowerCase();
			filteredTables = tables.filter((t) =>
				t.name.toLowerCase().includes(lowerFilter),
			);
		} else {
			filteredTables = tables;
		}
		selectedIndex = Math.min(
			selectedIndex,
			Math.max(0, filteredTables.length - 1),
		);
	};

	// Input loop
	while (true) {
		const key = await readKey();

		if (key === "q") {
			throw new Error("EXIT");
		}

		if (key === "\u001b") {
			// Escape - clear filter or exit
			if (filter) {
				filter = "";
				applyFilter();
				render();
			} else {
				throw new Error("EXIT");
			}
			continue;
		}

		if (key === "\u001b[A" || key === "k") {
			// Up arrow or k
			selectedIndex = Math.max(0, selectedIndex - 1);
			render();
		} else if (key === "\u001b[B" || key === "j") {
			// Down arrow or j
			selectedIndex = Math.min(filteredTables.length - 1, selectedIndex + 1);
			render();
		} else if (key === "\r" || key === "\n") {
			// Enter
			const selected = filteredTables[selectedIndex];
			if (selected) {
				const count =
					typeof selected.count === "number" ? selected.count : undefined;
				await recordsView(state, selected.name, count);
				render(true); // Full clear when returning from sub-view
			}
		} else if (key === "g") {
			// Go to top
			selectedIndex = 0;
			render();
		} else if (key === "G") {
			// Go to bottom
			selectedIndex = filteredTables.length - 1;
			render();
		} else if (key === "r" || key === "R") {
			// Refresh
			filter = "";
			selectedIndex = 0;
			await loadTables();
		} else if (key === "/") {
			// Search/filter
			render();
			filter = await readLine(theme.highlight("  Filter: "));
			applyFilter();
			render();
		}
	}
}
