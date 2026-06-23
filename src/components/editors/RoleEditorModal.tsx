import { useEffect, useState } from 'react';
import type { RoleEntry } from '../../lib/OreConfigManager';
import { Modal } from '../Modal';
import { fieldRow } from './shared';

interface RoleEditorModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial: RoleEntry;
  existingNames: string[];
  onClose: () => void;
  onSave: (next: RoleEntry) => void;
}

export interface RoleEditorState {
  type: 'role';
  mode: 'add' | 'edit';
  originalName: string | null;
  initial: RoleEntry;
}

export function RoleEditorModal({
  open,
  mode,
  initial,
  existingNames,
  onClose,
  onSave
}: RoleEditorModalProps) {
  const [name, setName] = useState(initial.name);
  const [machine, setMachine] = useState(initial.machine);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setName(initial.name);
    setMachine(initial.machine);
    setError('');
  }, [open, initial]);

  const save = () => {
    const nextName = name.trim();
    const nextMachine = machine.trim();

    if (!nextName) {
      setError('职责名称不能为空');
      return;
    }

    if (!nextMachine) {
      setError('机器名称不能为空');
      return;
    }

    if (existingNames.some((entry) => entry !== initial.name && entry === nextName)) {
      setError(`职责 "${nextName}" 已存在`);
      return;
    }

    onSave({ name: nextName, machine: nextMachine });
  };

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '新增职责' : '编辑职责'}
      subtitle="职责名称会联动流程、ME接口和白名单/黑名单。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--filled" onClick={save}>
            保存
          </button>
        </>
      }
    >
      <div className="modal-form">
        {fieldRow(
          '职责名称',
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：粉碎"
          />,
          '职责名称会作为配置里的 key。'
        )}

        {fieldRow(
          '机器名称',
          <input
            className="input"
            value={machine}
            onChange={(event) => setMachine(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：粉碎机"
          />,
          '这里保存对应的机器类型名称。'
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}
