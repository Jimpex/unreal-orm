import { RecordId as SurrealRecordId } from "surrealdb";
import type { FieldDefinition } from "../../schema/field-definitions/definitions";
import type {
	InferShapeFromFields,
	ModelInstance,
	TableDefineOptions,
} from "./types/model";

export function hydrate<
	TFields extends Record<string, FieldDefinition<unknown>>,
>(
	instance: ModelInstance<InferShapeFromFields<TFields>>,
	data: Record<string, unknown>,
	fields: TFields,
	options: TableDefineOptions<TFields>,
) {
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
			(instance as any).$dynamic[key] = value;
		}
	}
}
