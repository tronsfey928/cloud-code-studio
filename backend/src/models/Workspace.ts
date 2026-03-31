import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { sequelize } from '../config/database';

export type WorkspaceStatus = 'creating' | 'ready' | 'error';

export class Workspace extends Model<
  InferAttributes<Workspace>,
  InferCreationAttributes<Workspace>
> {
  declare id: CreationOptional<string>;
  declare userId: string;
  declare name: string;
  declare repositoryUrl: string;
  declare branch: CreationOptional<string>;
  declare workspacePath: CreationOptional<string | null>;
  declare status: CreationOptional<WorkspaceStatus>;
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
    workspacePath: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('creating', 'ready', 'error'),
      defaultValue: 'creating',
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
