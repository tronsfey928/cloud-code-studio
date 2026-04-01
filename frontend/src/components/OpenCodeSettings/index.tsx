import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  Checkbox,
  Switch,
  Button,
  Space,
  Divider,
  Typography,
  message,
  Spin,
  Radio,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SettingOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import api from '@/services/api';
import type { OpenCodeConfig, McpServer } from '@/types';

const { Title, Text } = Typography;

const CODING_PROVIDERS = [
  { value: 'opencode', label: 'OpenCode CLI' },
  { value: 'claude_code', label: 'Claude Code' },
];

const LLM_PROVIDERS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'azure', label: 'Azure OpenAI' },
  { value: 'ollama', label: 'Ollama (Local)' },
  { value: 'custom', label: 'Custom' },
];

const AVAILABLE_SKILLS = [
  { key: 'code_review', label: 'Code Review', desc: 'Review code for issues and improvements' },
  { key: 'refactor', label: 'Refactor', desc: 'Suggest and apply code refactoring' },
  { key: 'test_gen', label: 'Test Generation', desc: 'Generate unit and integration tests' },
  { key: 'explain', label: 'Explain', desc: 'Explain code and concepts' },
  { key: 'debug', label: 'Debug', desc: 'Help identify and fix bugs' },
  { key: 'document', label: 'Document', desc: 'Generate documentation and comments' },
  { key: 'optimize', label: 'Optimize', desc: 'Suggest performance optimizations' },
];

interface OpenCodeSettingsProps {
  workspaceId: string;
  open: boolean;
  onClose: () => void;
}

const OpenCodeSettings: React.FC<OpenCodeSettingsProps> = ({ workspaceId, open, onClose }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [setupCommands, setSetupCommands] = useState<string[]>([]);

  useEffect(() => {
    if (open && workspaceId) {
      setLoading(true);
      api
        .get<OpenCodeConfig>(`/opencode/${workspaceId}/config`)
        .then(({ data: config }) => {
          form.setFieldsValue({
            codingProvider: config.codingProvider ?? 'opencode',
            llmProvider: config.llmProvider,
            llmModel: config.llmModel ?? '',
            llmApiKey: config.llmApiKey ?? '',
            llmBaseUrl: config.llmBaseUrl ?? '',
            skills: config.skills ?? [],
          });
          setMcpServers(config.mcpServers ?? []);
          setSetupCommands(config.setupCommands ?? []);
        })
        .catch(() => {
          void message.error('Failed to load OpenCode configuration');
        })
        .finally(() => setLoading(false));
    }
  }, [open, workspaceId, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.put(`/opencode/${workspaceId}/config`, {
        ...values,
        mcpServers,
        setupCommands,
      });
      void message.success('Configuration saved');
      onClose();
    } catch {
      void message.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const addMcpServer = () => {
    setMcpServers((prev) => [
      ...prev,
      { name: '', url: '', enabled: true, transport: 'sse' },
    ]);
  };

  const updateMcpServer = (index: number, field: keyof McpServer, value: string | boolean | string[]) => {
    setMcpServers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const removeMcpServer = (index: number) => {
    setMcpServers((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <SettingOutlined className="text-blue-500" />
          <span>OpenCode Settings</span>
        </div>
      }
      open={open}
      onClose={onClose}
      width={520}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            Save Configuration
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center py-12">
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} layout="vertical" requiredMark={false}>
          {/* Coding Provider Section */}
          <div className="mb-6">
            <Title level={5} className="flex items-center gap-2 !mb-3">
              <CodeOutlined className="text-cyan-500" />
              Coding Provider
            </Title>
            <Text type="secondary" className="block mb-3 text-xs">
              Choose the AI coding tool to use in this workspace
            </Text>
            <Form.Item name="codingProvider" rules={[{ required: true }]}>
              <Radio.Group optionType="button" buttonStyle="solid">
                {CODING_PROVIDERS.map((p) => (
                  <Radio.Button key={p.value} value={p.value}>
                    {p.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
            </Form.Item>
          </div>

          <Divider />

          {/* LLM Provider Section */}
          <div className="mb-6">
            <Title level={5} className="flex items-center gap-2 !mb-3">
              <ApiOutlined className="text-purple-500" />
              LLM Provider
            </Title>

            <Form.Item
              name="llmProvider"
              label="Provider"
              rules={[{ required: true, message: 'Please select a provider' }]}
            >
              <Select options={LLM_PROVIDERS} placeholder="Select LLM provider" />
            </Form.Item>

            <Form.Item name="llmModel" label="Model">
              <Input placeholder="e.g., gpt-4, claude-3-sonnet, llama3" />
            </Form.Item>

            <Form.Item name="llmApiKey" label="API Key">
              <Input.Password placeholder="sk-..." autoComplete="off" />
            </Form.Item>

            <Form.Item name="llmBaseUrl" label="Base URL (optional)">
              <Input placeholder="https://api.openai.com/v1" />
            </Form.Item>
          </div>

          <Divider />

          {/* Skills Section */}
          <div className="mb-6">
            <Title level={5} className="flex items-center gap-2 !mb-3">
              <ThunderboltOutlined className="text-orange-500" />
              Skills
            </Title>
            <Text type="secondary" className="block mb-3 text-xs">
              Select the AI skills available in this workspace
            </Text>
            <Form.Item name="skills">
              <Checkbox.Group className="flex flex-col gap-2">
                {AVAILABLE_SKILLS.map((skill) => (
                  <Checkbox key={skill.key} value={skill.key}>
                    <span className="font-medium">{skill.label}</span>
                    <span className="text-xs text-gray-400 ml-2">— {skill.desc}</span>
                  </Checkbox>
                ))}
              </Checkbox.Group>
            </Form.Item>
          </div>

          <Divider />

          {/* Setup Commands Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <Title level={5} className="flex items-center gap-2 !mb-0">
                <ToolOutlined className="text-teal-500" />
                Setup Commands
              </Title>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                size="small"
                onClick={() => setSetupCommands((prev) => [...prev, ''])}
              >
                Add Command
              </Button>
            </div>
            <Text type="secondary" className="block mb-3 text-xs">
              Shell commands to run before each coding session (e.g. install dependencies, set up environment)
            </Text>

            {setupCommands.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                No setup commands configured
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {setupCommands.map((cmd, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      size="small"
                      placeholder="e.g. npm install"
                      value={cmd}
                      onChange={(e) =>
                        setSetupCommands((prev) =>
                          prev.map((c, i) => (i === index ? e.target.value : c))
                        )
                      }
                      className="font-mono"
                    />
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      danger
                      onClick={() =>
                        setSetupCommands((prev) => prev.filter((_, i) => i !== index))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <Divider />

          {/* MCP Servers Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <Title level={5} className="flex items-center gap-2 !mb-0">
                <ApiOutlined className="text-green-500" />
                MCP Servers
              </Title>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                size="small"
                onClick={addMcpServer}
              >
                Add Server
              </Button>
            </div>
            <Text type="secondary" className="block mb-3 text-xs">
              Configure Model Context Protocol servers for extended capabilities
            </Text>

            {mcpServers.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                No MCP servers configured
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {mcpServers.map((server, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Switch
                        size="small"
                        checked={server.enabled}
                        onChange={(checked) => updateMcpServer(index, 'enabled', checked)}
                      />
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        size="small"
                        danger
                        onClick={() => removeMcpServer(index)}
                      />
                    </div>
                    <Space direction="vertical" className="w-full" size="small">
                      <Input
                        size="small"
                        placeholder="Server name"
                        value={server.name}
                        onChange={(e) => updateMcpServer(index, 'name', e.target.value)}
                      />
                      <Select
                        size="small"
                        value={server.transport || 'sse'}
                        onChange={(val) => updateMcpServer(index, 'transport', val)}
                        options={[
                          { value: 'sse', label: 'SSE / HTTP' },
                          { value: 'stdio', label: 'stdio (command)' },
                        ]}
                        className="w-full"
                      />
                      {(server.transport || 'sse') === 'sse' ? (
                        <Input
                          size="small"
                          placeholder="http://localhost:3001"
                          value={server.url}
                          onChange={(e) => updateMcpServer(index, 'url', e.target.value)}
                        />
                      ) : (
                        <>
                          <Input
                            size="small"
                            placeholder="Command (e.g. npx, node)"
                            value={server.command || ''}
                            onChange={(e) => updateMcpServer(index, 'command', e.target.value)}
                          />
                          <Input
                            size="small"
                            placeholder="Arguments (comma-separated)"
                            value={(server.args || []).join(', ')}
                            onChange={(e) => {
                              const args = e.target.value.split(',').map((a) => a.trim()).filter(Boolean);
                              updateMcpServer(index, 'args', args);
                            }}
                          />
                        </>
                      )}
                    </Space>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Form>
      )}
    </Drawer>
  );
};

export default OpenCodeSettings;
