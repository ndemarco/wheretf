import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAssignment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  itemId: Types.ObjectId;

  // Location reference — the full path to the leaf location
  moduleId: Types.ObjectId;
  locationPath: string[];

  // If assigned within an insert, reference the insert and internal path
  insertId?: Types.ObjectId;
  insertLocationPath?: string[];

  // Computed unique key for the location (used for unique constraint)
  // Format: "moduleId:path:segment:...[/insertId:path:segment:...]"
  locationKey: string;

  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssignmentSchema = new Schema<IAssignment>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    itemId: { type: Schema.Types.ObjectId, required: true, index: true },
    moduleId: { type: Schema.Types.ObjectId, required: true, index: true },
    locationPath: { type: [String], required: true },
    insertId: { type: Schema.Types.ObjectId, index: true },
    insertLocationPath: { type: [String] },
    locationKey: { type: String, required: true },
    assignedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// One assignment per location, enforced via computed key
AssignmentSchema.index({ userId: 1, locationKey: 1 }, { unique: true });

// Efficient queries: "where are all my resistors?"
AssignmentSchema.index({ userId: 1, itemId: 1 });

// Efficient queries: "what's assigned in this module?"
AssignmentSchema.index({ userId: 1, moduleId: 1 });

// Efficient queries: "what's in this insert?"
AssignmentSchema.index({ userId: 1, insertId: 1 });

// Pre-save: compute locationKey
AssignmentSchema.pre('save', function () {
  this.locationKey = buildLocationKey(this);
});

export function buildLocationKey(assignment: {
  moduleId: Types.ObjectId;
  locationPath: string[];
  insertId?: Types.ObjectId;
  insertLocationPath?: string[];
}): string {
  let key = `${assignment.moduleId}:${assignment.locationPath.join(':')}`;
  if (assignment.insertId) {
    key += `/${assignment.insertId}:${(assignment.insertLocationPath || []).join(':')}`;
  }
  return key;
}

export default mongoose.models.Assignment ||
  mongoose.model<IAssignment>('Assignment', AssignmentSchema);
