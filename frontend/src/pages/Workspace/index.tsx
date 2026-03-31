import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, Breadcrumb, Badge, Spin, Tooltip, Tag, message } from 'antd';
import {
  ArrowLeftOutlined,
  HomeOutlined,
  CodeOutlined,
  SettingOutlined,
  GlobalOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import Chat from '@/components/Chat';
import FileExplorer from '@/components/FileExplorer';
import OpenCodeSettings from '@/components/OpenCodeSettings';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/services/api';
import type { ChatSession } from '@/types';

const { Header, Content, Sider } = Layout;

/** Only allow http(s) localhost URLs for the dev-server iframe */
function isSafeDevServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

const Workspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaces, fetchWorkspaces, currentWorkspace, setCurrentWorkspace } =
    useWorkspaceStore();
  const { setSessionId, sessionId, devServer, setDevServer, workspaceInfo } = useChatStore();
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!id) return;
    if (workspaces.length === 0) {
      void fetchWorkspaces();
    } else {
      const ws = workspaces.find((w) => w.id === id);
      if (ws) setCurrentWorkspace(ws);
    }
  }, [id, workspaces, fetchWorkspaces, setCurrentWorkspace]);

  // Fetch or create chat session for this workspace
  useEffect(() => {
    if (!id) return;

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    api
      .get<ChatSession[]>('/chat/sessions', {
        params: { workspaceId: id },
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (data.length > 0) {
          setSessionId(data[0].id);
        } else {
          return api
            .post<ChatSession>('/chat/sessions', { workspaceId: id }, { signal: controller.signal })
            .then(({ data: session }) => {
              if (!controller.signal.aborted) {
                setSessionId(session.id);
              }
            });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Log and show an error instead of silently falling back
        console.error('Failed to load chat session', err);
        void message.error('Failed to initialize chat session');
      });

    return () => {
      controller.abort();
    };
  }, [id, setSessionId]);

  if (!id) {
    navigate('/dashboard');
    return null;
  }

  return (
    <Layout className="h-screen overflow-hidden">
      <Header className="flex items-center justify-between px-4 bg-gray-900 border-b border-gray-700 h-12 leading-none shrink-0">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/dashboard')}
            className="text-gray-300 hover:text-white"
            size="small"
          />
          <CodeOutlined className="text-blue-400 text-lg" />
          <Breadcrumb
            className="text-sm"
            items={[
              {
                title: (
                  <span
                    className="text-gray-400 hover:text-white cursor-pointer"
                    onClick={() => navigate('/dashboard')}
                  >
                    <HomeOutlined className="mr-1" />
                    Dashboard
                  </span>
                ),
              },
              {
                title: (
                  <span className="text-gray-200 font-medium">
                    {currentWorkspace?.name ?? id}
                  </span>
                ),
              },
            ]}
          />
          {workspaceInfo && (
            <Tag color="blue" className="text-xs ml-2">
              {workspaceInfo.branch} · {workspaceInfo.fileCount} files
            </Tag>
          )}
        </div>

        <div className="flex items-center gap-3">
          {currentWorkspace && (
            <Badge
              status={
                currentWorkspace.status === 'ready'
                  ? 'success'
                  : currentWorkspace.status === 'creating'
                  ? 'processing'
                  : 'error'
              }
              text={
                <span className="text-xs text-gray-300 capitalize">
                  {currentWorkspace.status}
                </span>
              }
            />
          )}
          <Tooltip title="OpenCode Settings">
            <Button
              icon={<SettingOutlined />}
              size="small"
              onClick={() => setSettingsOpen(true)}
              className="text-gray-300 border-gray-500 hover:text-white hover:border-white"
              ghost
            />
          </Tooltip>
        </div>
      </Header>

      <Content className="flex overflow-hidden h-full">
        {!currentWorkspace ? (
          <div className="flex items-center justify-center w-full">
            <Spin size="large" tip="Loading workspace…" />
          </div>
        ) : (
          <>
            {/* Chat panel */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              <ErrorBoundary>
                <Chat sessionId={sessionId} />
              </ErrorBoundary>
            </div>

            {/* Right panel: File Explorer + Dev Server Preview */}
            <Sider
              width={480}
              theme="light"
              className="border-l border-gray-200 overflow-hidden flex flex-col"
            >
              {/* Dev server iframe preview */}
              {devServer && devServer.status === 'running' && isSafeDevServerUrl(devServer.url) && (
                <div className="border-b border-gray-200 flex flex-col" style={{ height: '40%' }}>
                  <div className="flex items-center justify-between px-3 py-2 bg-green-50 border-b border-green-200 shrink-0">
                    <div className="flex items-center gap-2">
                      <GlobalOutlined className="text-green-600" />
                      <span className="text-xs font-semibold text-green-800">Live Preview</span>
                      <Tag color="green" className="text-xs">
                        :{devServer.port}
                      </Tag>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      icon={<CloseOutlined />}
                      onClick={() => setDevServer(null)}
                      className="text-gray-400 hover:text-red-500"
                    />
                  </div>
                  <iframe
                    src={devServer.url}
                    title="Dev Server Preview"
                    className="flex-1 w-full border-0"
                    sandbox="allow-scripts allow-forms allow-popups"
                  />
                </div>
              )}

              {/* File explorer fills remaining space */}
              <div className={devServer?.status === 'running' ? 'flex-1 overflow-hidden' : 'h-full overflow-hidden'}>
                <ErrorBoundary>
                  <FileExplorer workspaceId={id} />
                </ErrorBoundary>
              </div>
            </Sider>
          </>
        )}
      </Content>
      <OpenCodeSettings
        workspaceId={id}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Layout>
  );
};

export default Workspace;
