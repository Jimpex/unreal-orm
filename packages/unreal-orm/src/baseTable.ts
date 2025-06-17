import type { RecordId } from 'surrealdb';

/**
 * Base class for all ORM table models.
 * Instance properties are dynamically assigned based on field definitions.
 */
export class BaseTable<TTableData extends { id: RecordId }, TInstanceMethods = Record<string, unknown>> {
  readonly id: RecordId;

  /**
   * Creates an instance of a model.
   * @param data The initial data for the record, including its ID.
   *             The shape of data should conform to InferTableDataFromFields for the specific model.
   */
  constructor(data: TTableData) {
    this.id = data.id;
    // The rest of the properties will be assigned by the DynamicModelBase constructor,
    // which has access to the schema for hydration.
  }

  // Common instance methods can be added here later (e.g., $save, $delete, $update)
  // For now, we keep it minimal as per the design to allow user-defined methods
  // on the classes returned by defineTable.
}
