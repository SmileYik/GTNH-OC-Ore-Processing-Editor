import { useEffect, useState } from 'react';
import type { InterfaceEntry } from '../../lib/OreConfigManager';
import { Modal } from '../Modal';
import { fieldRow } from './shared';

interface InterfaceEditorModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initial: InterfaceEntry;
  availableRoles: string[];
  existingIds: string[];
  onClose: () => void;
  onSave: (next: InterfaceEntry) => void;
}

export interface InterfaceEditorState {
  type: 'interface';
  mode: 'add' | 'edit';
  originalId: string | null;
  initial: InterfaceEntry;
}

export function InterfaceEditorModal({
  open,
  mode,
  initial,
  availableRoles,
  existingIds,
  onClose,
  onSave
}: InterfaceEditorModalProps) {
  const [id, setId] = useState(initial.id);
  const [role, setRole] = useState(initial.role);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setId(initial.id);
    setRole(initial.role || availableRoles[0] || '');
    setError('');
  }, [open, initial, availableRoles]);

  const save = () => {
    const nextId = id.trim();
    const nextRole = role.trim();

    if (!nextId) {
      setError('输出口 ID 不能为空');
      return;
    }

    if (!nextRole) {
      setError('职责不能为空');
      return;
    }

    if (!availableRoles.includes(nextRole)) {
      setError('职责必须来自当前配置');
      return;
    }

    if (existingIds.some((entry) => entry !== initial.id && entry === nextId)) {
      setError(`输出口 "${nextId}" 已存在`);
      return;
    }

    onSave({ id: nextId, role: nextRole });
  };

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '新增输出口' : '编辑输出口'}
      subtitle="输出口 ID 需要唯一，并且要指向一个职责。"
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
          '输出口 ID',
          <input
            className="input"
            value={id}
            onChange={(event) => setId(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            placeholder="例如：c6220ff-e6bb-452f-b505-ec45ac813170"
          />,
          '这里保存的是输出口表里的 key。'
        )}

        {fieldRow(
          '职责',
          <select
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                save();
              }
            }}
            disabled={availableRoles.length === 0}
          >
            {availableRoles.length === 0 ? (
              <option value="">暂无可用职责</option>
            ) : (
              <>
                <option value="" disabled>
                  选择职责
                </option>
                {availableRoles.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </>
            )}
          </select>,
          '只能选择当前配置中已有的职责。'
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}
