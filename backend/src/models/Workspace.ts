import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { sequelize } from '../config/database';

export type WorkspaceStatus = 'creating' | 'running' | 'stopped' | 'error';

export interface WorkspaceConfig {
  resources: {
    cpu: string;
    memory: string;
    storage: string;
  };
  environment: Record<string, string>;
}

export class Workspace extends Model<
  InferAttributes<Workspace>,
  InferCreationAttributes<Workspace>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare name: string;
  declare repositoryUrl: string;
  declare branch: CreationOptional<string>;
  declare containerId: CreationOptional<string | null>;
  declare status: CreationOptional<WorkspaceStatus>;
  declare config: CreationOptional<WorkspaceConfig>;
  declare lastAccessedAt: CreationOptional<Date>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

Workspace.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    repositoryUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    branch: {
      type: DataTypes.STRING(255),
      defaultValue: 'main',
    },
    containerId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('creating', 'running', 'stopped', 'error'),
      defaultValue: 'creating',
    },
    config: {
      type: DataTypes.JSON,
      defaultValue: {
        resources: { cpu: '0.5', memory: '512m', storage: '1g' },
        environment: {},
      },
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'workspaces',
    indexes: [
      { fields: ['userId'] },
      { unique: true, fields: ['userId', 'name'] },
    ],
  }
);
