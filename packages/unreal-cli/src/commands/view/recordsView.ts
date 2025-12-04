import type { ViewState } from "./types";
import { theme } from "./theme";
import { clearScreen, softRefresh, readKey } from "./terminal";
import { renderHeader, renderTableWithSelection, stripAnsi } from "./render";
import { formatValue } from "./format";
import { recordDetailView } from "./recordDetailView";

/**
 * Records view - shows paginated records for a table with row selection
 */
export async function recordsView(
	state: ViewState,
	tableName: string,
	totalCount?: number,
): Promise<void> {
	let offset = 0;
	let selectedRow = 0;
	let records: Record<string, unknown>[] = [];
	let columns: string[] = [];
	let loading = true;
	let firstRender = true;
	const actualTotal = totalCount;

	const fetchRecords = async () => {
		loading = true;
		render(firstRender); // Full clear on first render
		firstRender = false;

		const [queryResults] = await state.db
			.query(
				`SELECT * FROM \`${tableName}\` LIMIT ${state.pageSize} START ${offset} TIMEOUT ${state.timeout}s`,
			)
			.collect();
		records = (queryResults as Record<string, unknown>[]) || [];

		// Determine columns from records
		const colSet = new Set<string>(["id"]);
		for (const r of records) {
			for (const k of Object.keys(r)) {
				colSet.add(k);
			}
		}
		columns = Array.from(colSet);
		selectedRow = Math.min(selectedRow, Math.max(0, records.length - 1));

		loading = false;
		render();
	};

	const render = (full = false) => {
		if (full) {
			clearScreen();
		} else {
			softRefresh();
		}

		// Calculate how many rows we can show
		// Chrome: header(2) + separator(1) + blank(1) + table borders(3) + footer(2) = 9 lines
		const termHeight = process.stdout.rows || 24;
		const maxDataRows = Math.max(3, termHeight - 9);
		const visibleRecords = records.slice(0, maxDataRows);

		const countStr =
			actualTotal !== undefined ? ` (${actualTotal} records)` : "";
		const pageNum = Math.floor(offset / state.pageSize) + 1;
		const totalPages =
			actualTotal !== undefined ? Math.ceil(actualTotal / state.pageSize) : "?";
		renderHeader(
			`Table: ${tableName}${countStr}`,
			`Page ${pageNum}/${totalPages}`,
		);

		if (loading) {
			console.log(theme.dim("  Loading records..."));
			return;
		}

		if (records.length === 0) {
			console.log(theme.dim("  No records found."));
			console.log(theme.dim("  b back • q quit"));
			return;
		}

		// Calculate column widths
		const termWidth = process.stdout.columns || 80;
		const maxColWidth = Math.floor(termWidth / columns.length) - 1;
		const colWidths = columns.map((col) => {
			let max = col.length;
			for (const r of visibleRecords) {
				const val = formatValue(r[col]);
				max = Math.max(max, stripAnsi(val).length);
			}
			return Math.min(max + 2, maxColWidth);
		});

		// Build rows with selection highlighting
		const rows = visibleRecords.map((r, idx) =>
			columns.map((col) => {
				const val = formatValue(r[col]);
				return idx === selectedRow ? theme.primary(stripAnsi(val)) : val;
			}),
		);

		renderTableWithSelection(columns, rows, colWidths, selectedRow);

		// Footer info (single line)
		const endOffset = offset + visibleRecords.length;
		const totalStr = actualTotal !== undefined ? `/${actualTotal}` : "";
		const recordNum = offset + selectedRow + 1;
		console.log(
			theme.dim(
				`  ${recordNum}${totalStr} • ${offset + 1}-${endOffset} • ↑↓ select • Enter view • ←→ page • b back • q quit`,
			),
		);
	};

	await fetchRecords();

	// Input loop
	while (true) {
		const key = await readKey();

		if (key === "q") {
			throw new Error("EXIT");
		}

		if (key === "b" || key === "\u001b") {
			// b or Escape - go back
			return;
		}

		if (key === "\u001b[A" || key === "k") {
			// Up arrow or k
			if (selectedRow > 0) {
				selectedRow--;
				render();
			} else if (offset > 0) {
				// Go to previous page, select last row
				offset = Math.max(0, offset - state.pageSize);
				selectedRow = state.pageSize - 1;
				await fetchRecords();
			}
		} else if (key === "\u001b[B" || key === "j") {
			// Down arrow or j
			if (selectedRow < records.length - 1) {
				selectedRow++;
				render();
			} else if (
				actualTotal === undefined ||
				offset + records.length < actualTotal
			) {
				// Go to next page, select first row
				offset += state.pageSize;
				selectedRow = 0;
				await fetchRecords();
			}
		} else if (key === "\u001b[D" || key === "h" || key === "[") {
			// Left arrow, h, or [ - previous page
			if (offset > 0) {
				offset = Math.max(0, offset - state.pageSize);
				selectedRow = 0;
				await fetchRecords();
			}
		} else if (key === "\u001b[C" || key === "l" || key === "]") {
			// Right arrow, l, or ] - next page
			if (actualTotal === undefined || offset + state.pageSize < actualTotal) {
				offset += state.pageSize;
				selectedRow = 0;
				await fetchRecords();
			}
		} else if (key === "\r" || key === "\n") {
			// Enter - view record detail
			const record = records[selectedRow];
			if (record) {
				const result = await recordDetailView(state, tableName, record);
				if (result === "deleted") {
					// Refresh the list after deletion
					await fetchRecords();
				} else {
					// Refresh to show any updates
					await fetchRecords();
				}
			}
		} else if (key === "g") {
			// Go to first page
			offset = 0;
			selectedRow = 0;
			await fetchRecords();
		} else if (key === "G" && actualTotal !== undefined) {
			// Go to last page
			offset = Math.max(
				0,
				Math.floor((actualTotal - 1) / state.pageSize) * state.pageSize,
			);
			selectedRow = 0;
			await fetchRecords();
		}
	}
}
