import React from 'react';

const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-1 px-4 py-2">
    <span className="text-gray-400 text-sm mr-1">AI is typing</span>
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

export default TypingIndicator;
