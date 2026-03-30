import mongoose, { Document, Schema } from 'mongoose';
import { MessageType } from '../types';

interface IMessage {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  role: 'user' | 'assistant' | 'system';
}

export interface IChatSession extends Document {
  workspaceId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  messages: IMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
    },
    content: { type: String, required: true },
    timestamp: { type: Number, required: true },
    isStreaming: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema<IChatSession>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messages: [MessageSchema],
  },
  {
    timestamps: true,
  }
);

export const ChatSession = mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
