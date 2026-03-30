import React, { useEffect, useState, useCallback } from 'react';
import { Tree, Spin, Alert, Typography, Tooltip, message } from 'antd';
import {
  FolderOutlined,
  FolderOpenOutlined,
  FileOutlined,
  ReloadOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import api from '@/services/api';
import type { FileTreeNode } from '@/types';

interface FileExplorerProps {
  workspaceId: string;
}

function buildTreeData(nodes: FileTreeNode[]): DataNode[] {
  return nodes.map((node) => ({
    key: node.path,
    title: node.name,
    isLeaf: node.type === 'file',
    icon:
      node.type === 'directory' ? (
        ({ expanded }: { expanded?: boolean }) =>
          expanded ? (
            <FolderOpenOutlined className="text-yellow-500" />
          ) : (
            <FolderOutlined className="text-yellow-500" />
          )
      ) : (
        <FileOutlined className="text-blue-400" />
      ),
    children: node.children ? buildTreeData(node.children) : undefined,
  }));
}

const FileExplorer: React.FC<FileExplorerProps> = ({ workspaceId }) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<FileTreeNode[]>(
        `/files/${workspaceId}/tree`,
      );
      setTreeData(buildTreeData(data));
    } catch {
      setError('Failed to load file tree.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const handleSelect = async (
    _: React.Key[],
    info: { node: DataNode },
  ) => {
    const node = info.node;
    if (!node.isLeaf) return;
    const filePath = String(node.key);
    setSelectedPath(filePath);
    setFileLoading(true);
    setFileContent(null);
    try {
      const { data } = await api.get<{ content: string; path: string; encoding: string }>(
        `/files/${workspaceId}/read`,
        { params: { path: filePath } },
      );
      setFileContent(data.content);
    } catch {
      setFileContent('// Failed to load file content.');
    } finally {
      setFileLoading(false);
    }
  };

  const handleCopy = () => {
    if (fileContent) {
      navigator.clipboard.writeText(fileContent).then(() => {
        void message.success('Copied to clipboard');
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 shrink-0">
        <span className="font-semibold text-gray-700 text-sm">File Explorer</span>
        <Tooltip title="Refresh">
          <ReloadOutlined
            className="cursor-pointer text-gray-400 hover:text-blue-500 transition-colors"
            onClick={fetchTree}
          />
        </Tooltip>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Tree panel */}
        <div className="w-56 shrink-0 border-r border-gray-100 overflow-y-auto py-2">
          {loading && (
            <div className="flex justify-center py-6">
              <Spin size="small" />
            </div>
          )}
          {error && (
            <Alert type="error" message={error} className="m-2 text-xs" />
          )}
          {!loading && !error && treeData.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-4">No files found</p>
          )}
          {!loading && treeData.length > 0 && (
            <Tree
              showIcon
              treeData={treeData}
              onSelect={handleSelect as (keys: React.Key[], info: { node: DataNode }) => void}
              selectedKeys={selectedPath ? [selectedPath] : []}
              className="text-sm"
            />
          )}
        </div>

        {/* File content panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedPath ? (
            <>
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 shrink-0">
                <Typography.Text
                  className="text-xs font-mono text-gray-600 truncate max-w-[200px]"
                  title={selectedPath}
                >
                  {selectedPath}
                </Typography.Text>
                <Tooltip title="Copy content">
                  <CopyOutlined
                    className="cursor-pointer text-gray-400 hover:text-blue-500"
                    onClick={handleCopy}
                  />
                </Tooltip>
              </div>
              <div className="flex-1 overflow-auto">
                {fileLoading ? (
                  <div className="flex justify-center py-8">
                    <Spin />
                  </div>
                ) : (
                  <pre className="text-xs font-mono p-4 text-gray-800 whitespace-pre leading-relaxed m-0">
                    {fileContent}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Select a file to view its contents
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileExplorer;
