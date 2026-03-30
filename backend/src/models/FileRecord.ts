import mongoose, { Document, Schema } from 'mongoose';

export interface IFileRecord extends Document {
  sessionId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  storageUrl: string;
}

const FileRecordSchema = new Schema<IFileRecord>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
    mimeType: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    storageUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

export const FileRecord = mongoose.model<IFileRecord>('FileRecord', FileRecordSchema);
