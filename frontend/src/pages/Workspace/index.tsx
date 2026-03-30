import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, Breadcrumb, Badge, Spin, Tooltip, message } from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  HomeOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import Chat from '@/components/Chat';
import FileExplorer from '@/components/FileExplorer';
import ErrorBoundary from '@/components/Common/ErrorBoundary';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/services/api';
import type { ChatSession } from '@/types';

const { Header, Content, Sider } = Layout;

const Workspace: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { workspaces, fetchWorkspaces, currentWorkspace, setCurrentWorkspace, startWorkspace, stopWorkspace } =
    useWorkspaceStore();
  const { setSessionId, sessionId } = useChatStore();
  const [wsLoading, setWsLoading] = React.useState(false);

  useEffect(() => {
    if (!id) return;
    if (workspaces.length === 0) {
      void fetchWorkspaces();
    } else {
      const ws = workspaces.find((w) => w._id === id);
      if (ws) setCurrentWorkspace(ws);
    }
  }, [id, workspaces, fetchWorkspaces, setCurrentWorkspace]);

  // Fetch or create chat session for this workspace
  useEffect(() => {
    if (!id) return;
    api
      .get<ChatSession[]>(`/sessions?workspaceId=${id}`)
      .then(({ data }) => {
        if (data.length > 0) {
          setSessionId(data[0]._id);
        } else {
          return api
            .post<ChatSession>('/sessions', { workspaceId: id })
            .then(({ data: session }) => setSessionId(session._id));
        }
      })
      .catch(() => {
        // Session endpoint may not exist yet; use workspace id as fallback
        setSessionId(id);
      });
  }, [id, setSessionId]);

  const handleStart = async () => {
    if (!id) return;
    setWsLoading(true);
    try {
      await startWorkspace(id);
      void message.success('Workspace started');
    } catch {
      void message.error('Failed to start workspace');
    } finally {
      setWsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!id) return;
    setWsLoading(true);
    try {
      await stopWorkspace(id);
      void message.success('Workspace stopped');
    } catch {
      void message.error('Failed to stop workspace');
    } finally {
      setWsLoading(false);
    }
  };

  if (!id) {
    navigate('/dashboard');
    return null;
  }

  const isRunning = currentWorkspace?.status === 'running';

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
        </div>

        <div className="flex items-center gap-3">
          {currentWorkspace && (
            <Badge
              status={
                currentWorkspace.status === 'running'
                  ? 'success'
                  : currentWorkspace.status === 'creating'
                  ? 'processing'
                  : currentWorkspace.status === 'error'
                  ? 'error'
                  : 'default'
              }
              text={
                <span className="text-xs text-gray-300 capitalize">
                  {currentWorkspace.status}
                </span>
              }
            />
          )}
          {isRunning ? (
            <Tooltip title="Stop workspace">
              <Button
                icon={<PauseCircleOutlined />}
                size="small"
                loading={wsLoading}
                onClick={() => void handleStop()}
                className="text-orange-400 border-orange-400 hover:text-orange-300 hover:border-orange-300"
                ghost
              >
                Stop
              </Button>
            </Tooltip>
          ) : (
            <Tooltip title="Start workspace">
              <Button
                icon={<PlayCircleOutlined />}
                size="small"
                loading={wsLoading}
                onClick={() => void handleStart()}
                disabled={currentWorkspace?.status === 'creating'}
                type="primary"
              >
                Start
              </Button>
            </Tooltip>
          )}
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

            {/* File explorer sider */}
            <Sider
              width={480}
              theme="light"
              className="border-l border-gray-200 overflow-hidden"
            >
              <ErrorBoundary>
                <FileExplorer workspaceId={id} />
              </ErrorBoundary>
            </Sider>
          </>
        )}
      </Content>
    </Layout>
  );
};

export default Workspace;
