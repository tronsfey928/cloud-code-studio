import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button, Upload, Tooltip } from 'antd';
import { SendOutlined, PaperClipOutlined, CloseCircleOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { FileAttachment } from '@/types';

interface MessageInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => void;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const attachments: FileAttachment[] = fileList.map((f) => ({
      path: f.name,
      name: f.name,
      mimeType: f.type ?? 'application/octet-stream',
    }));

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setFileList([]);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {fileList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {fileList.map((f) => (
            <div
              key={f.uid}
              className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-700"
            >
              <span className="max-w-[120px] truncate">{f.name}</span>
              <CloseCircleOutlined
                className="cursor-pointer hover:text-red-500"
                onClick={() => setFileList((prev) => prev.filter((x) => x.uid !== f.uid))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Upload
          fileList={fileList}
          onChange={({ fileList: fl }) => setFileList(fl)}
          // Files are collected locally and sent with the message payload,
          // not uploaded independently — hence beforeUpload returns false.
          beforeUpload={() => false}
          showUploadList={false}
          multiple
        >
          <Tooltip title="Attach file">
            <Button
              icon={<PaperClipOutlined />}
              type="text"
              disabled={disabled}
              className="text-gray-400 hover:text-blue-500"
            />
          </Tooltip>
        </Upload>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 min-h-[40px] max-h-[160px] overflow-y-auto leading-relaxed disabled:bg-gray-50 disabled:text-gray-400 transition-colors"
          style={{ lineHeight: '1.5' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
        />
        <Tooltip title="Send (Enter)">
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="rounded-xl h-10 w-10 flex items-center justify-center shrink-0"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default MessageInput;
