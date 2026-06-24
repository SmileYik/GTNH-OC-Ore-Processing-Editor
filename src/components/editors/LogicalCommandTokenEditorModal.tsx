import { useEffect, useMemo, useState } from 'react';
import type { LogicalExpressionCommandToken } from '../../lib/logical/LogicalRules';
import {
  formatLogicalCommandSnapshot,
  getLogicalCommandDefinition,
  getLogicalCommandNameOptions
} from '../../lib/logical/LogicalRules';
import { Modal } from '../Modal';
import { fieldRow } from './shared';

interface LogicalCommandTokenEditorModalProps {
  open: boolean;
  token: LogicalExpressionCommandToken | null;
  onClose: () => void;
  onSave: (next: { name: string; args: string }) => void;
}

export function LogicalCommandTokenEditorModal({
  open,
  token,
  onClose,
  onSave
}: LogicalCommandTokenEditorModalProps) {
  const [name, setName] = useState(token?.name ?? '');
  const [args, setArgs] = useState(token?.args ?? '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !token) {
      return;
    }

    setName(token.name);
    setArgs(token.args);
    setError('');
  }, [open, token]);

  const selectedDefinition = useMemo(() => getLogicalCommandDefinition(name), [name]);
  const nameOptions = useMemo(() => getLogicalCommandNameOptions(name), [name]);

  const handleSave = () => {
    const nextName = name.trim();
    if (!nextName) {
      setError('命令名不能为空');
      return;
    }

    onSave({
      name: nextName,
      args
    });
  };

  if (!open || !token) {
    return null;
  }

  const footer = (
    <>
      <button type="button" className="button button--tonal" onClick={onClose}>
        取消
      </button>
      <button type="button" className="button button--filled" onClick={handleSave}>
        保存命令
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      title="编辑命令单元"
      // subtitle="只编辑当前选中的命令节点，不影响整个规则结构。"
      sheetClassName="modal-sheet--logical-token"
      onClose={onClose}
      footer={footer}
    >
      <div className="logical-command-token-editor">
        {fieldRow(
          '命令名称',
          <select className="input" value={name} onChange={(event) => setName(event.target.value)}>
            {nameOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>,
          '可在本名和别名之间切换，保存时会保留当前选择。'
        )}

        {selectedDefinition
          ? selectedDefinition.renderArgsField({
              value: args,
              onChange: setArgs
            })
          : fieldRow(
              '参数',
              <input className="input" value={args} onChange={(event) => setArgs(event.target.value)} />,
              '参数会原样传给执行器。'
            )}

        <div className="logical-command-token-editor__summary">
          <span className="chip chip--soft">{selectedDefinition?.label ?? '自定义命令'}</span>
          <span className="logical-command-token-editor__summary-text">
            {formatLogicalCommandSnapshot({ name, args })}
          </span>
        </div>

        {selectedDefinition ? (
          <div className="logical-token-editor__definition">
            <strong>命令说明</strong>
            <p>{selectedDefinition.description}</p>
            <p>别名: {selectedDefinition.aliases.join(' / ') || '无'}</p>
          </div>
        ) : (
          <div className="logical-token-editor__definition">
            <strong>自定义命令</strong>
            <p>只要命令名符合执行器的命名规则，就可以保存。</p>
          </div>
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}
