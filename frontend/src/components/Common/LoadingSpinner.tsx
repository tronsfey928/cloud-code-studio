import React from 'react';
import { Spin } from 'antd';

interface LoadingSpinnerProps {
  size?: 'small' | 'default' | 'large';
  fullPage?: boolean;
  tip?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'default',
  fullPage = false,
  tip,
}) => {
  if (fullPage) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-50">
        <Spin size={size} tip={tip ?? 'Loading…'} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-8">
      <Spin size={size} tip={tip} />
    </div>
  );
};

export default LoadingSpinner;
