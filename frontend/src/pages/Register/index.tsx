import React from 'react';
import { Form, Input, Button, Card, Typography, Divider, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import type { RegisterPayload } from '@/types';

const { Title, Text } = Typography;

const Register: React.FC = () => {
  const [form] = Form.useForm<RegisterPayload>();
  const { register } = useAuth();
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (values: RegisterPayload) => {
    setLoading(true);
    try {
      await register(values);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Registration failed. Please try again.';
      void message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0">
        <div className="text-center mb-6">
          <Title level={2} className="!mb-1 text-gray-800">
            Create Account
          </Title>
          <Text type="secondary">Join CloudCode Studio today</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          requiredMark={false}
          size="large"
        >
          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please enter a username' },
              { min: 3, message: 'Username must be at least 3 characters' },
              { max: 30, message: 'Username must not exceed 30 characters' },
            ]}
          >
            <Input prefix={<UserOutlined className="text-gray-300" />} placeholder="johndoe" />
          </Form.Item>

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
              placeholder="john@example.com"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Please enter a password' },
              { min: 8, message: 'Password must be at least 8 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-300" />}
              placeholder="At least 8 characters"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-300" />}
              placeholder="Repeat your password"
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
              Create Account
            </Button>
          </Form.Item>
        </Form>

        <Divider className="my-4">
          <Text type="secondary" className="text-sm">Already have an account?</Text>
        </Divider>
        <div className="text-center">
          <Link to="/login">
            <Button type="link">Sign in</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default Register;
