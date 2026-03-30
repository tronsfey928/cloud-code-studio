import React from 'react';
import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { LoginPayload } from '@/types';

const { Title, Text } = Typography;

const Login: React.FC = () => {
  const [form] = Form.useForm<LoginPayload>();
  const { login } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (values: LoginPayload) => {
    setLoading(true);
    try {
      await login(values);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Login failed. Please check your credentials.';
      void message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⌨️</div>
          <Title level={2} className="!mb-1 text-gray-800">
            CloudCode Studio
          </Title>
          <Text type="secondary">Sign in to your workspace</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          size="large"
          initialValues={{ email: '', password: '' }}
        >
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please enter your email' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-gray-300" />}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-300" />}
              placeholder="Your password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item className="mb-2">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              className="h-11 rounded-lg font-medium"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider className="my-4">
          <Text type="secondary" className="text-sm">New to CloudCode Studio?</Text>
        </Divider>
        <div className="text-center">
          <Link to="/register">
            <Button type="link">Create an account</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
