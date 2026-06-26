import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Modal } from './Modal';

interface ImportConfigModalProps {
  open: boolean;
  initialFileName: string;
  onClose: () => void;
  onImport: (text: string, fileName: string) => void;
}

async function readFileText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const encodings: Array<'utf-8' | 'gb18030'> = ['utf-8', 'gb18030'];

  for (const encoding of encodings) {
    try {
      return new TextDecoder(encoding, encoding === 'utf-8' ? { fatal: true } : undefined).decode(buffer);
    } catch {
      // Try next encoding.
    }
  }

  return new TextDecoder().decode(buffer);
}

export function ImportConfigModal({ open, initialFileName, onClose, onImport }: ImportConfigModalProps) {
  const [fileName, setFileName] = useState(initialFileName);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setFileName(initialFileName);
    setText('');
    setError('');
  }, [open, initialFileName]);

  const handleReadClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setError('剪贴板里没有可导入的文本');
        return;
      }

      setText(clipboardText);
      setError('');
    } catch (clipboardError) {
      setError(clipboardError instanceof Error ? clipboardError.message : String(clipboardError));
    }
  };

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const fileText = await readFileText(file);
      setText(fileText);
      setFileName(file.name);
      setError('');
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : String(fileError));
    }
  };

  const handleImport = () => {
    const nextText = text.trim();
    if (!nextText) {
      setError('请输入或粘贴配置文本');
      return;
    }

    onImport(nextText, fileName.trim());
  };

  return (
    <Modal
      open={open}
      title="导入配置"
      subtitle="支持直接粘贴剪贴板内容，也支持从文件读取后自动填入文本框。"
      wide
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--filled" onClick={handleImport}>
            导入
          </button>
        </>
      }
    >
      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".config,.lua,.txt,text/plain"
        onChange={handleFileChange}
      />

      <div className="modal-form">
        <label className="field">
          <span className="field-label">文件名</span>
          <div className="field-control">
            <input
              className="input"
              value={fileName}
              onChange={(event) => setFileName(event.target.value)}
              placeholder="ore.config"
            />
          </div>
          <span className="field-hint">这个名字会用于下载时的文件名。</span>
        </label>

        <label className="field field--full">
          <span className="field-label">配置文本</span>
          <div className="field-control field-control--stack">
            <textarea
              className="input import-textarea"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="把 Lua 配置粘贴到这里，或者点下面按钮从剪贴板或文件读取。"
            />
            <div className="button-row">
              <button type="button" className="button button--tonal button--compact" onClick={handleReadClipboard}>
                从剪贴板中读取
              </button>
              <button type="button" className="button button--tonal button--compact" onClick={handlePickFile}>
                从文件中读取
              </button>
            </div>
          </div>
          <span className="field-hint">导入过程完全在本地浏览器中完成，不会上传到服务器。</span>
        </label>

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}
