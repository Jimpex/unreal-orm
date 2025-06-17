import type { RecordId } from 'surrealdb';
import type {
  FieldOptions,
  FieldDefinition,
  InferFieldType,
  AnyTableDefinition,
  AnyModelClass,
  InferShapeFromFields,
  ModelInstance,
  InferTableDataFromFields
} from './types';

// --- Field Definition Functions ---


/** Options for array fields */
/**
 * Options for array fields. Only 'max' is supported, per SurrealDB docs.
 * @see https://surrealdb.com/docs/surrealql/datamodel
 */
export interface ArrayFieldOptions<T> extends FieldOptions {
  max?: number;
}


/** Options for record link fields */
export interface RecordFieldOptions extends FieldOptions {
  reference?: boolean;
  onDelete?: 'cascade' | 'set null' | 'none';
}


export const Field = {
  /**
   * Defines a string field for a model property.
   *
   * @param options Optional field options (assert, default, permissions, etc.)
   * @returns FieldDefinition<string>
   * @example
   *   name: Field.string({ assert: '$value.length > 3', comment: 'User name' })
   */
  string(options: FieldOptions = {}): FieldDefinition<string> {
    return { ...options, type: 'string' };
  },

  /**
   * Defines a number field for a model property.
   *
   * @param options Optional field options (assert, default, permissions, etc.)
   * @returns FieldDefinition<number>
   * @example
   *   age: Field.number({ assert: '$value >= 0', default: '0' })
   */
  number(options: FieldOptions = {}): FieldDefinition<number> {
    return { ...options, type: 'number' };
  },

  /**
   * Defines a boolean field for a model property.
   *
   * @param options Optional field options (default, permissions, etc.)
   * @returns FieldDefinition<boolean>
   * @example
   *   isActive: Field.bool({ default: 'true' })
   */
  bool(options: FieldOptions = {}): FieldDefinition<boolean> {
    return { ...options, type: 'bool' };
  },

  /**
   * Defines a datetime field for a model property.
   *
   * @param options Optional field options (default, permissions, etc.)
   * @returns FieldDefinition<Date>
   * @example
   *   createdAt: Field.datetime({ default: 'time::now()' })
   */
  datetime(options: FieldOptions = {}): FieldDefinition<Date> {
    return { ...options, type: 'datetime' };
  },

  /**
   * Defines a field with a custom SurrealQL type string.
   * Useful for advanced or not-yet-implemented types.
   *
   * @param typeString The raw SurrealQL type (e.g., 'duration', 'geometry<point>').
   * @param options Optional field options.
   * @returns FieldDefinition<T>
   * @example
   *   duration: Field.custom<number>('duration')
   */
  custom<T>(typeString: string, options: FieldOptions = {}): FieldDefinition<T> {
    return { ...options, type: typeString };
  },

  /**
   * Makes a field optional (able to accept NONE/null).
   * Wraps the field's type in `option<...>`.
   *
   * @param fieldDefinition The field to make optional. All base properties (assert, default, permissions, etc.) are inherited from FieldOptions.
   * @returns FieldDefinition<T | undefined>
   * @example
   *   nickname: Field.option(Field.string())
   */
  option<FD extends FieldDefinition<unknown>>(
    fieldDefinition: FD
  ): FieldDefinition<InferFieldType<FD> | undefined> {
    return {
      ...fieldDefinition, // Inherit base properties (assert, default, permissions, etc.)
      get type() { // Override type
        return `option<${fieldDefinition.type}>`;
      },
      isOptional: true, // Add option-specific property
    };
  },

  /**
   * Defines an array field for a model property.
   * Supports the SurrealDB `max` option for array length.
   *
   * @param element The field definition for the array's elements.
   * @param options ArrayFieldOptions (supports `max` and all FieldOptions)
   * @returns FieldDefinition<Array<T>>
   * @example
   *   tags: Field.array(Field.string(), { max: 10 })
   *   posts: Field.array(Field.record((): any => Post), { max: 100 })
   */
  array<TElementDef extends FieldDefinition<unknown>>(
    element: TElementDef,
    options: ArrayFieldOptions<InferFieldType<TElementDef>> = {} // Options for the array field itself
  ): FieldDefinition<Array<InferFieldType<TElementDef>>> {
    return {
      ...options, // Apply options specific to the array field (e.g., default for the array)
      get type() {
        return options.max ? `array<${element.type}, ${options.max}>` : `array<${element.type}>`;
      },
      arrayElementType: element, // Store the full definition of the element type
    };
  },

  /**
   * Defines a nested object field for a model property.
   * The schema generator will handle defining sub-fields with dot notation.
   *
   * @param schema The field definitions for the nested object.
   * @param options Optional field options.
   * @returns FieldDefinition<object>
   * @example
   *   profile: Field.object({
   *     bio: Field.string(),
   *     website: Field.option(Field.string()),
   *   })
   */
  object<TSchema extends Record<string, FieldDefinition<unknown>>>(
    schema: TSchema,
    options: FieldOptions = {}
  ): FieldDefinition<InferShapeFromFields<TSchema>> {
    return {
      ...options,
      type: 'object',
      objectSchema: schema,
    };
  },

  /**
   * Defines a record link field, connecting to another table.
   * Generates the `record<...>` type string for SurrealDB relations.
   *
   * @param tableClassThunk A thunk returning the model class to link to (avoids circular dependencies).
   * @param options RecordFieldOptions (reference, onDelete, etc.)
   * @returns FieldDefinition<InstanceType<TModel> | RecordId>
   * @example
   *   author: Field.record(() => User)
   *   comments: Field.array(Field.record((): any => Comment), { max: 100 })
   */
  record<TModel extends AnyModelClass>(
    tableClassThunk: () => TModel,
    options: RecordFieldOptions = {}
  ): FieldDefinition<
    | InstanceType<TModel>
    | RecordId<TModel['_tableName']>
  > {
    return {
      ...options,
      get type() {
        const tableClass = tableClassThunk();
        return `record<${tableClass._tableName}>`;
      },
      recordTableThunk: tableClassThunk,
    };
  },
};
