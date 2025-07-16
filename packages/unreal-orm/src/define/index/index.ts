import type { AnyModelClass } from "../table/types/model";
import type { IndexDefineOptions, IndexDefinition } from "./types";

export const Index = {
	define(
		tableThunk: () => AnyModelClass,
		options: IndexDefineOptions,
	): IndexDefinition {
		const table = tableThunk();
		return {
			_type: "index",
			...options,
			table,
		};
	},
};
