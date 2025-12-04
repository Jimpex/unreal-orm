import type { ViewState, PendingChange } from "./types";
import { theme } from "./theme";
import {
	clearScreen,
	softRefresh,
	readKey,
	editText,
	wasCancelled,
} from "./terminal";
import {
	renderHeader,
	confirmYesNo,
	confirmAction,
	showError,
	showSuccess,
} from "./render";
import { parseValue, formatValue } from "./format";

/**
 * Record detail view - shows full record with field selection and batch editing
 */
export async function recordDetailView(
	state: ViewState,
	tableName: string,
	record: Record<string, unknown>,
): Promise<"back" | "deleted" | "updated"> {
	const recordId = record.id ? String(record.id) : "unknown";
	let selectedField = 0;
	const originalRecord: Record<string, unknown> = { ...record };
	const workingRecord: Record<string, unknown> = { ...record };
	const pendingChanges: PendingChange[] = [];

	// Get sorted keys (id first, then alphabetical)
	const getKeys = () =>
		Object.keys(workingRecord).sort((a, b) => {
			if (a === "id") return -1;
			if (b === "id") return 1;
			return a.localeCompare(b);
		});

	// Check if a field has pending changes
	const getFieldStatus = (
		key: string,
	): "edited" | "added" | "removed" | null => {
		for (const change of pendingChanges) {
			if (change.type === "add" && change.key === key) return "added";
			if (change.type === "edit" && change.key === key) return "edited";
			if (change.type === "remove" && change.key === key) return "removed";
		}
		return null;
	};

	const hasPendingChanges = () => pendingChanges.length > 0;

	const render = (full = false) => {
		if (full) {
			clearScreen();
		} else {
			softRefresh();
		}

		// Calculate available height
		// Chrome: header(2) + separator(1) + footer(2) = 5 lines
		const termHeight = process.stdout.rows || 24;
		const termWidth = process.stdout.columns || 80;
		const maxFields = Math.max(3, termHeight - 5);

		const changeCount = pendingChanges.length;
		const subtitle =
			changeCount > 0
				? `${changeCount} changes • s save • x discard`
				: tableName;
		renderHeader(`Record: ${recordId}`, subtitle);

		const keys = getKeys();
		const maxKeyLen = Math.min(Math.max(...keys.map((k) => k.length), 8), 20);
		const maxValLen = termWidth - maxKeyLen - 6; // prefix(2) + padding(2) + margin(2)

		// Calculate visible range (scroll if needed)
		let startIdx = 0;
		if (selectedField >= maxFields) {
			startIdx = selectedField - maxFields + 1;
		}
		const endIdx = Math.min(startIdx + maxFields, keys.length);

		for (let i = startIdx; i < endIdx; i++) {
			const key = keys[i];
			if (!key) continue;
			const val = workingRecord[key];
			const isSelected = i === selectedField;
			const status = getFieldStatus(key);

			// Prefix with selection indicator
			const prefix = isSelected ? theme.primary("▸ ") : "  ";

			// Color key based on status
			let keyStr: string;
			if (status === "added") {
				keyStr = theme.success(
					`+ ${key.slice(0, maxKeyLen - 2).padEnd(maxKeyLen - 2)}`,
				);
			} else if (status === "edited") {
				keyStr = theme.warning(
					`~ ${key.slice(0, maxKeyLen - 2).padEnd(maxKeyLen - 2)}`,
				);
			} else if (status === "removed") {
				keyStr = theme.error(
					`- ${key.slice(0, maxKeyLen - 2).padEnd(maxKeyLen - 2)}`,
				);
			} else if (isSelected) {
				keyStr = theme.primary.bold(key.slice(0, maxKeyLen).padEnd(maxKeyLen));
			} else {
				keyStr = theme.highlight(key.slice(0, maxKeyLen).padEnd(maxKeyLen));
			}

			// Format value - use shared formatValue with dynamic maxLen
			const valStr = formatValue(val, maxValLen);
			console.log(`${prefix}${keyStr}  ${valStr}`);
		}

		// Footer
		const posInfo =
			keys.length > maxFields
				? `${startIdx + 1}-${endIdx}/${keys.length} • `
				: "";
		console.log(
			theme.dim(
				`  ${posInfo}↑↓ nav • e edit • + add • - del • d delete • b back • q quit`,
			),
		);
	};

	render(true); // Full clear on initial render

	// Input loop
	while (true) {
		const key = await readKey();
		const keys = getKeys();

		if (key === "q") {
			if (hasPendingChanges()) {
				const discard = await confirmYesNo("Discard unsaved changes?");
				if (!discard) {
					render();
					continue;
				}
			}
			throw new Error("EXIT");
		}

		if (key === "b" || key === "\u001b") {
			if (hasPendingChanges()) {
				const discard = await confirmYesNo("Discard unsaved changes?");
				if (!discard) {
					render();
					continue;
				}
			}
			return "back";
		}

		if (key === "\u001b[A" || key === "k") {
			// Up
			selectedField = Math.max(0, selectedField - 1);
			render();
		} else if (key === "\u001b[B" || key === "j") {
			// Down
			selectedField = Math.min(keys.length - 1, selectedField + 1);
			render();
		} else if (key === "e" || key === "\r" || key === "\n") {
			// Edit field
			const fieldKey = keys[selectedField];
			if (fieldKey && fieldKey !== "id") {
				const currentValue = workingRecord[fieldKey];
				const newValue = await editFieldValue(fieldKey, currentValue);
				if (newValue !== undefined) {
					// Check if actually changed
					const originalValue = originalRecord[fieldKey];
					if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
						// Remove any existing edit for this field
						const existingIdx = pendingChanges.findIndex(
							(c) => c.type === "edit" && c.key === fieldKey,
						);
						if (existingIdx >= 0) pendingChanges.splice(existingIdx, 1);

						pendingChanges.push({
							type: "edit",
							key: fieldKey,
							oldValue: originalValue,
							newValue,
						});
					} else {
						// Reverted to original - remove pending change
						const existingIdx = pendingChanges.findIndex(
							(c) => c.type === "edit" && c.key === fieldKey,
						);
						if (existingIdx >= 0) pendingChanges.splice(existingIdx, 1);
					}
					workingRecord[fieldKey] = newValue;
				}
				render();
			} else if (fieldKey === "id") {
				await showError("Cannot edit the id field");
				render();
			}
		} else if (key === "+" || key === "=") {
			// Add new field
			const result = await promptNewField();
			if (result) {
				workingRecord[result.key] = result.value;
				pendingChanges.push({
					type: "add",
					key: result.key,
					value: result.value,
				});
			}
			render();
		} else if (key === "-" || key === "_") {
			// Remove field (mark for removal)
			const fieldKey = keys[selectedField];
			if (fieldKey && fieldKey !== "id") {
				const status = getFieldStatus(fieldKey);
				if (status === "added") {
					// Just remove the pending add
					const idx = pendingChanges.findIndex(
						(c) => c.type === "add" && c.key === fieldKey,
					);
					if (idx >= 0) pendingChanges.splice(idx, 1);
					delete workingRecord[fieldKey];
				} else {
					// Mark for removal
					pendingChanges.push({
						type: "remove",
						key: fieldKey,
						oldValue: originalRecord[fieldKey],
					});
					delete workingRecord[fieldKey];
				}
				selectedField = Math.min(selectedField, keys.length - 2);
				render();
			} else if (fieldKey === "id") {
				await showError("Cannot remove the id field");
				render();
			}
		} else if (key === "u" || key === "U") {
			// Undo last change
			const lastChange = pendingChanges.pop();
			if (lastChange) {
				if (lastChange.type === "edit") {
					workingRecord[lastChange.key] = lastChange.oldValue;
				} else if (lastChange.type === "add") {
					delete workingRecord[lastChange.key];
				} else if (lastChange.type === "remove") {
					workingRecord[lastChange.key] = lastChange.oldValue;
				}
			}
			render();
		} else if (key === "x" || key === "X") {
			// Discard all changes
			if (hasPendingChanges()) {
				const discard = await confirmYesNo("Discard all changes?");
				if (discard) {
					pendingChanges.length = 0;
					for (const k of Object.keys(workingRecord)) {
						delete workingRecord[k];
					}
					Object.assign(workingRecord, originalRecord);
				}
				render();
			}
		} else if (key === "s" || key === "S") {
			// Save changes
			if (hasPendingChanges()) {
				const confirmed = await confirmYesNo(
					`Save ${pendingChanges.length} change${pendingChanges.length > 1 ? "s" : ""}?`,
				);
				if (confirmed) {
					try {
						// Build update query
						const setFields: string[] = [];
						const unsetFields: string[] = [];
						const params: Record<string, unknown> = {};

						for (const change of pendingChanges) {
							if (change.type === "edit" || change.type === "add") {
								const paramName = `p_${change.key.replace(/[^a-zA-Z0-9]/g, "_")}`;
								setFields.push(`\`${change.key}\` = $${paramName}`);
								params[paramName] =
									change.type === "edit" ? change.newValue : change.value;
							} else if (change.type === "remove") {
								unsetFields.push(`\`${change.key}\``);
							}
						}

						let query = `UPDATE ${recordId}`;
						if (setFields.length > 0) {
							query += ` SET ${setFields.join(", ")}`;
						}
						if (unsetFields.length > 0) {
							query += ` UNSET ${unsetFields.join(", ")}`;
						}
						query += ` TIMEOUT ${state.timeout}s`;

						await state.db.query(query, params).collect();

						// Clear pending changes and update original
						pendingChanges.length = 0;
						for (const k of Object.keys(originalRecord)) {
							delete originalRecord[k];
						}
						Object.assign(originalRecord, workingRecord);

						await showSuccess("Changes saved successfully");
					} catch (err) {
						await showError(
							`Failed to save: ${err instanceof Error ? err.message : String(err)}`,
						);
					}
				}
				render();
			}
		} else if (key === "d" || key === "D") {
			// Delete record
			const confirmed = await confirmAction(
				`Delete record ${recordId}? Type "delete" to confirm:`,
				"delete",
			);
			if (confirmed) {
				try {
					await state.db
						.query(`DELETE ${recordId} TIMEOUT ${state.timeout}s`)
						.collect();
					return "deleted";
				} catch (err) {
					await showError(
						`Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
					);
					render();
				}
			} else {
				render();
			}
		}
	}
}

/**
 * Edit a field value using the multi-line text editor
 */
async function editFieldValue(
	fieldKey: string,
	currentValue: unknown,
): Promise<unknown | undefined> {
	// Format value for editing - pretty print objects/arrays
	const editStr =
		typeof currentValue === "object"
			? JSON.stringify(currentValue, null, 2)
			: String(currentValue ?? "");

	const input = await editText(editStr, {
		title: `Edit: ${fieldKey}`,
		subtitle: "Arrows to move • Type to edit • Ctrl+S save • Esc cancel",
	});

	if (wasCancelled(input)) {
		return undefined;
	}

	return parseValue(input);
}

/**
 * Prompt for a new field (name and value)
 */
async function promptNewField(): Promise<{
	key: string;
	value: unknown;
} | null> {
	// Get field name
	const fieldName = await editText("", {
		title: "Add Field - Enter Name",
		subtitle: "Type field name • Ctrl+S confirm • Esc cancel",
	});
	if (wasCancelled(fieldName) || !fieldName.trim()) return null;

	// Get field value
	const valueStr = await editText("", {
		title: `Add Field: ${fieldName.trim()}`,
		subtitle:
			"Type value (JSON for objects/arrays) • Ctrl+S confirm • Esc cancel",
	});
	if (wasCancelled(valueStr)) return null;

	return { key: fieldName.trim(), value: parseValue(valueStr) };
}
