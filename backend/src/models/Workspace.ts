import mongoose, { Document, Schema } from 'mongoose';

export type WorkspaceStatus = 'creating' | 'running' | 'stopped' | 'error';

export interface IWorkspace extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  repositoryUrl: string;
  branch: string;
  containerId?: string;
  status: WorkspaceStatus;
  createdAt: Date;
  lastAccessedAt: Date;
  config: {
    resources: {
      cpu: string;
      memory: string;
      storage: string;
    };
    environment: Record<string, string>;
  };
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    repositoryUrl: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      default: 'main',
      trim: true,
    },
    containerId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['creating', 'running', 'stopped', 'error'],
      default: 'creating',
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    config: {
      resources: {
        cpu: { type: String, default: '0.5' },
        memory: { type: String, default: '512m' },
        storage: { type: String, default: '1g' },
      },
      environment: {
        type: Map,
        of: String,
        default: {},
      },
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
  }
);

WorkspaceSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Workspace = mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
