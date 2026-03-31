import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  Badge,
  Dropdown,
  Typography,
  Empty,
  Spin,
  message,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EllipsisOutlined,
  CodeOutlined,
  LogoutOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuth } from '@/hooks/useAuth';
import type { CreateWorkspacePayload, Workspace } from '@/types';
import { getWorkspaceStatusColor } from '@/utils/helpers';

const { Title, Text } = Typography;

const statusLabel: Record<Workspace['status'], string> = {
  creating: 'Creating',
  ready: 'Ready',
  error: 'Error',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    workspaces,
    loading,
    fetchWorkspaces,
    createWorkspace,
    deleteWorkspace,
  } = useWorkspaceStore();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm<CreateWorkspacePayload>();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleCreate = async (values: CreateWorkspacePayload) => {
    setCreating(true);
    try {
      const ws = await createWorkspace(values);
      void message.success(`Workspace "${ws.name}" created`);
      setCreateModalOpen(false);
      createForm.resetFields();
    } catch {
      void message.error('Failed to create workspace');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorkspace(id);
      void message.success('Workspace deleted');
    } catch {
      void message.error('Failed to delete workspace');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <CodeOutlined className="text-blue-500 text-2xl" />
          <Title level={4} className="!mb-0 text-gray-800">
            CloudCode Studio
          </Title>
        </div>
        <div className="flex items-center gap-3">
          <Tooltip title={user?.email}>
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <UserOutlined />
              {user?.username}
            </span>
          </Tooltip>
          <Button icon={<LogoutOutlined />} type="text" onClick={logout} size="small">
            Sign out
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Title level={3} className="!mb-1">
              My Workspaces
            </Title>
            <Text type="secondary">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            size="large"
            className="rounded-lg"
          >
            New Workspace
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Spin size="large" tip="Loading workspaces…" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex justify-center py-20">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No workspaces yet"
            >
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create your first workspace
              </Button>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workspaces.map((ws) => (
              <Card
                key={ws.id}
                hoverable
                className="rounded-xl border border-gray-200 shadow-sm transition-shadow hover:shadow-md cursor-pointer"
                onClick={() => navigate(`/workspace/${ws.id}`)}
                actions={[
                  <span key="more" onClick={(e) => e.stopPropagation()}>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'delete',
                          label: 'Delete',
                          icon: <DeleteOutlined />,
                          danger: true,
                          onClick: ({ domEvent }) => {
                            domEvent.stopPropagation();
                            Modal.confirm({
                              title: 'Delete workspace?',
                              content: `"${ws.name}" will be permanently deleted.`,
                              okText: 'Delete',
                              okButtonProps: { danger: true },
                              onOk: () => void handleDelete(ws.id),
                            });
                          },
                        },
                      ],
                    }}
                  >
                    <Button type="text" icon={<EllipsisOutlined />} size="small" />
                  </Dropdown>
                  </span>,
                ]}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate text-base leading-tight">
                      {ws.name}
                    </p>
                    {ws.repositoryUrl && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">
                        {ws.repositoryUrl}
                      </p>
                    )}
                  </div>
                  <Badge
                    status={getWorkspaceStatusColor(ws.status) as 'processing' | 'success' | 'default' | 'error'}
                    text={
                      <span className="text-xs text-gray-500">
                        {statusLabel[ws.status]}
                      </span>
                    }
                  />
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>Branch: <strong className="text-gray-600">{ws.branch || 'main'}</strong></span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Create Workspace Modal */}
      <Modal
        title="New Workspace"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={480}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          requiredMark={false}
          size="large"
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="Workspace Name"
            rules={[
              { required: true, message: 'Please enter a workspace name' },
              { min: 2, message: 'Name must be at least 2 characters' },
            ]}
          >
            <Input placeholder="my-project" />
          </Form.Item>

          <Form.Item name="repositoryUrl" label="Repository URL (optional)">
            <Input placeholder="https://github.com/org/repo.git" />
          </Form.Item>

          <Form.Item name="branch" label="Branch (optional)">
            <Input placeholder="main" />
          </Form.Item>

          <div className="flex gap-3 justify-end mt-2">
            <Button
              onClick={() => {
                setCreateModalOpen(false);
                createForm.resetFields();
              }}
            >
              Cancel
            </Button>
            <Button type="primary" htmlType="submit" loading={creating}>
              Create Workspace
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Dashboard;
