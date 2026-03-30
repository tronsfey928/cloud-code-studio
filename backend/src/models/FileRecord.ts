import {
  Model,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from 'sequelize';
import { sequelize } from '../config/database';

export class FileRecord extends Model<
  InferAttributes<FileRecord>,
  InferCreationAttributes<FileRecord>
> {
  declare id: CreationOptional<string>;
  declare sessionId: string;
  declare workspaceId: string;
  declare filename: string;
  declare path: string;
  declare size: number;
  declare mimeType: string;
  declare uploadedAt: CreationOptional<Date>;
  declare storageUrl: string;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

FileRecord.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    workspaceId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    filename: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    path: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    mimeType: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    uploadedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    storageUrl: {
      type: DataTypes.STRING(2048),
      allowNull: false,
    },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'file_records',
    indexes: [
      { fields: ['sessionId'] },
      { fields: ['workspaceId'] },
    ],
  }
);
