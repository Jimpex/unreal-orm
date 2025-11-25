import { RecordId as SurrealRecordId } from "surrealdb";
import type { FieldDefinition } from "../field/types";
import type {
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
} from "./types/model";

/**
 * Hydrates a model instance with raw data from the database.
 * This function iterates over the raw data and, for each field, uses the `hydrateValue` helper
 * to convert plain objects into full model instances, including recursively hydrating related records
 * (e.g., a `user` object with a `posts` array).
 *
 * For schemaless tables, any fields in the data that are not defined in the schema
 * are assigned directly to the instance as properties.
 *
 * @param instance The model instance to hydrate.
 * @param data The raw data from the database.
 * @param fields The field definitions for the model.
 * @param options The table definition options.
 * @internal
 */
export function hydrate<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(
	instance: ModelInstance<InferShapeFromFields<TFields>>,
	data: Record<string, unknown>,
	fields: TFields,
	options: TableDefineOptions<TFields>,
) {
	/**
	 * Recursively hydrates a single value based on its field definition.
	 * - If the field is a `record` link and the value is a fetched object, it instantiates the related model.
	 * - If the field is an `array` of records and the value is an array of fetched objects, it maps over them and instantiates each one.
	 * - If the field is a nested `object`, it recursively hydrates the object's properties.
	 * - Otherwise, it returns the value as-is.
	 *
	 * @param value The value to hydrate.
	 * @param fieldDef The definition of the field.
	 * @returns The hydrated value.
	 */
	function hydrateValue(
		value: unknown,
		fieldDef: FieldDefinition<unknown> | undefined,
	): unknown {
		if (!fieldDef) return value;

		if (
			fieldDef.type?.startsWith?.("record<") &&
			fieldDef.recordTableThunk &&
			typeof value === "object" &&
			value !== null &&
			!(value instanceof SurrealRecordId) &&
			!Array.isArray(value)
		) {
			const RelatedModel = fieldDef.recordTableThunk();
			return new RelatedModel(
				value as InferShapeFromFields<typeof RelatedModel._fields>,
			);
		}

		if (
			fieldDef.arrayElementType?.type?.startsWith?.("record<") &&
			fieldDef.arrayElementType.recordTableThunk &&
			Array.isArray(value)
		) {
			const RelatedModel = fieldDef.arrayElementType.recordTableThunk();
			return value.map((item) =>
				typeof item === "object" &&
				item !== null &&
				!(item instanceof SurrealRecordId)
					? new RelatedModel(item)
					: item,
			);
		}

		if (
			fieldDef.type === "object" &&
			fieldDef.objectSchema &&
			typeof value === "object" &&
			value !== null
		) {
			const hydratedObj: Record<string, unknown> = {};
			for (const key in fieldDef.objectSchema) {
				if (Object.prototype.hasOwnProperty.call(fieldDef.objectSchema, key)) {
					hydratedObj[key] = hydrateValue(
						(value as Record<string, unknown>)?.[key],
						fieldDef.objectSchema?.[key],
					);
				}
			}
			for (const key in value as Record<string, unknown>) {
				if (!fieldDef.objectSchema?.[key]) {
					hydratedObj[key] = (value as Record<string, unknown>)[key];
				}
			}
			return hydratedObj;
		}

		return value;
	}

	for (const key in data) {
		if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
		if (key === "id") continue;

		const fieldDef = fields[key as keyof TFields];
		const value = data[key as keyof typeof data];

		if (fieldDef) {
			// biome-ignore lint/suspicious/noExplicitAny: Hydration is a dynamic process
			(instance as any)[key] = hydrateValue(value, fieldDef);
		} else if (!options.schemafull) {
			// biome-ignore lint/suspicious/noExplicitAny: Hydration is a dynamic process
			(instance as any)[key] = value;
		}
	}
}
