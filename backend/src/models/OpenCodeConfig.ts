import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { sequelize } from '../config/database';

export interface McpServerConfig {
  name: string;
  url: string;
  enabled: boolean;
}

export class OpenCodeConfig extends Model<
  InferAttributes<OpenCodeConfig>,
  InferCreationAttributes<OpenCodeConfig>
> {
  declare id: CreationOptional<string>;
  declare workspaceId: string;
  declare llmProvider: CreationOptional<string>;
  declare llmModel: CreationOptional<string | null>;
  declare llmApiKey: CreationOptional<string | null>;
  declare llmBaseUrl: CreationOptional<string | null>;
  declare skills: CreationOptional<string[]>;
  declare mcpServers: CreationOptional<McpServerConfig[]>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

OpenCodeConfig.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    workspaceId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    llmProvider: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: 'openai',
    },
    llmModel: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    llmApiKey: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    llmBaseUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
    },
    skills: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    mcpServers: {
      type: DataTypes.JSON,
      defaultValue: [],
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'opencode_configs',
    indexes: [{ unique: true, fields: ['workspaceId'] }],
  }
);
