import React, { useState, useRef, KeyboardEvent } from 'react';
import { Button, Upload, Tooltip, Switch } from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  CloseCircleOutlined,
  PictureOutlined,
  OrderedListOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';
import type { FileAttachment } from '@/types';
import { useChatStore } from '@/stores/chatStore';

interface MessageInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => void;
  disabled?: boolean;
}

/** Convert a File to base64 data URL */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const MessageInput: React.FC<MessageInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { planMode, setPlanMode } = useChatStore();

  /** Maximum file size: 5 MB */
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    const attachments: FileAttachment[] = [];

    for (const f of fileList) {
      // Enforce per-file size limit
      if (f.size && f.size > MAX_FILE_SIZE) continue;

      const isImage = f.type?.startsWith('image/');
      let data: string | undefined;

      if (isImage && f.originFileObj) {
        data = await fileToBase64(f.originFileObj);
      }

      attachments.push({
        path: f.name,
        name: f.name,
        mimeType: f.type ?? 'application/octet-stream',
        data,
      });
    }

    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setFileList([]);
    setImagePreviewUrls({});
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleFileChange = async ({ fileList: fl }: { fileList: UploadFile[] }) => {
    // Filter out files exceeding the size limit
    const accepted = fl.filter((f) => !f.size || f.size <= MAX_FILE_SIZE);
    if (accepted.length < fl.length) {
      // If we filtered some files, the user should know
      console.warn('Some files exceeded the 5 MB limit and were removed.');
    }
    setFileList(accepted);
    // Generate image previews
    const previews: Record<string, string> = { ...imagePreviewUrls };
    for (const f of accepted) {
      if (f.type?.startsWith('image/') && f.originFileObj && !previews[f.uid]) {
        previews[f.uid] = await fileToBase64(f.originFileObj);
      }
    }
    setImagePreviewUrls(previews);
  };

  const removeFile = (uid: string) => {
    setFileList((prev) => prev.filter((x) => x.uid !== uid));
    setImagePreviewUrls((prev) => {
      const next = { ...prev };
      delete next[uid];
      return next;
    });
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* Image / file preview chips */}
      {fileList.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {fileList.map((f) => (
            <div
              key={f.uid}
              className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 text-xs text-blue-700"
            >
              {imagePreviewUrls[f.uid] ? (
                <img
                  src={imagePreviewUrls[f.uid]}
                  alt={f.name}
                  className="w-8 h-8 object-cover rounded"
                />
              ) : (
                <PictureOutlined />
              )}
              <span className="max-w-[100px] truncate">{f.name}</span>
              <CloseCircleOutlined
                className="cursor-pointer hover:text-red-500"
                onClick={() => removeFile(f.uid)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Plan mode toggle */}
      <div className="flex items-center gap-3 mb-2">
        <Tooltip title="Plan mode: AI will generate a plan for your approval before coding">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <OrderedListOutlined />
            <span>Plan Mode</span>
            <Switch
              size="small"
              checked={planMode}
              onChange={setPlanMode}
              disabled={disabled}
            />
          </div>
        </Tooltip>
      </div>

      <div className="flex items-end gap-2">
        <Upload
          fileList={fileList}
          onChange={(info) => void handleFileChange(info)}
          beforeUpload={() => false}
          showUploadList={false}
          multiple
          accept="image/*,.txt,.md,.json,.csv,.pdf"
        >
          <Tooltip title="Attach file or image">
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
          placeholder={
            planMode
              ? 'Describe your requirements… AI will create a plan first'
              : 'Type a message… (Enter to send, Shift+Enter for newline)'
          }
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
            onClick={() => void handleSend()}
            disabled={disabled || !value.trim()}
            className="rounded-xl h-10 w-10 flex items-center justify-center shrink-0"
          />
        </Tooltip>
      </div>
    </div>
  );
};

export default MessageInput;
