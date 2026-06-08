import { Fragment, useEffect, useRef, useState } from 'react';
import type { MineralProcess } from '../lib/luaConfig';
import { StepPath } from './dashboard/common';
import { Modal } from './Modal';

interface FlowNode {
  id: string;
  step: string;
}

type DragSource =
  | {
      kind: 'palette';
      step: string;
    }
  | {
      kind: 'node';
      id: string;
    }
  | null;

interface ProcessSaveOptions {
  forceReplace?: boolean;
}

interface ProcessBuilderModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialMineral: string;
  initialSteps: string[];
  availableSteps: string[];
  existingProcesses: MineralProcess[];
  onClose: () => void;
  onSave: (next: MineralProcess, options?: ProcessSaveOptions) => void;
}

function createNode(step: string): FlowNode {
  return {
    id: `node_${Math.random().toString(36).slice(2, 10)}`,
    step
  };
}

function cloneSteps(steps: string[]): FlowNode[] {
  return steps.map((step) => createNode(step));
}

function countLabel(count: number): string {
  return `${count} 个步骤`;
}

interface SlotProps {
  index: number;
  active: boolean;
  onDropAt: (index: number) => void;
  onDragEnterAt: (index: number) => void;
}

function FlowSlot({ index, active, onDropAt, onDragEnterAt }: SlotProps) {
  return (
    <button
      type="button"
      className={`flow-slot${active ? ' is-active' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={() => onDragEnterAt(index)}
      onDrop={(event) => {
        event.preventDefault();
        onDropAt(index);
      }}
      aria-label={`插入到位置 ${index + 1}`}
    >
      <span>{active ? '插入' : '+'}</span>
    </button>
  );
}

export function ProcessBuilderModal({
  open,
  mode,
  initialMineral,
  initialSteps,
  availableSteps,
  existingProcesses,
  onClose,
  onSave
}: ProcessBuilderModalProps) {
  const [mineral, setMineral] = useState(initialMineral);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<MineralProcess | null>(null);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null);
  const dragSourceRef = useRef<DragSource>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setMineral(initialMineral);
    setNodes(cloneSteps(initialSteps));
    setError('');
    setConflict(null);
    setActiveSlotIndex(null);
    dragSourceRef.current = null;
  }, [open, initialMineral, initialSteps]);

  const draftSteps = nodes.map((node) => node.step).filter(Boolean);
  const nextMineral = mineral.trim();

  const clearConflict = () => {
    setConflict(null);
  };

  const insertNodeAt = (step: string, index: number) => {
    clearConflict();
    setNodes((current) => {
      const next = [...current];
      next.splice(index, 0, createNode(step));
      return next;
    });
  };

  const moveNodeTo = (id: string, index: number) => {
    clearConflict();
    setNodes((current) => {
      const sourceIndex = current.findIndex((node) => node.id === id);
      if (sourceIndex < 0) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(sourceIndex, 1);
      let targetIndex = index;

      if (sourceIndex < index) {
        targetIndex -= 1;
      }

      targetIndex = Math.max(0, Math.min(targetIndex, next.length));
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const handleDropAt = (index: number) => {
    const source = dragSourceRef.current;
    if (!source) {
      return;
    }

    if (source.kind === 'palette') {
      insertNodeAt(source.step, index);
    } else {
      moveNodeTo(source.id, index);
    }

    dragSourceRef.current = null;
    setActiveSlotIndex(null);
  };

  const removeNode = (id: string) => {
    clearConflict();
    setNodes((current) => current.filter((node) => node.id !== id));
  };

  const handleSave = (forceReplace = false) => {
    const steps = draftSteps;

    if (!nextMineral) {
      setError('矿物名称不能为空');
      return;
    }

    if (steps.length === 0) {
      setError('至少需要一个处理步骤');
      return;
    }

    const existingProcess = existingProcesses.find(
      (entry) => entry.mineral === nextMineral && entry.mineral !== initialMineral
    );

    if (existingProcess && !forceReplace) {
      setError('');
      setConflict(existingProcess);
      return;
    }

    setError('');
    setConflict(null);
    onSave({ mineral: nextMineral, steps }, { forceReplace });
  };

  const footer = conflict ? (
    <>
      <button type="button" className="button button--tonal" onClick={clearConflict}>
        返回编辑
      </button>
      <button type="button" className="button button--filled" onClick={() => handleSave(true)}>
        替换并保存
      </button>
    </>
  ) : (
    <>
      <button type="button" className="button button--tonal" onClick={onClose}>
        取消
      </button>
      <button type="button" className="button button--filled" onClick={() => handleSave(false)}>
        保存
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      title={mode === 'add' ? '新增矿物流程' : '编辑矿物流程'}
      subtitle="把左侧的职责卡片拖到右侧流程线里，或者直接点击添加。右侧卡片还能继续拖拽调整顺序。"
      wide
      onClose={onClose}
      footer={footer}
    >
      <div className="process-builder">
        {error ? <div className="form-error">{error}</div> : null}
        <label className="field field--full">
          <span className="field-label">矿物名称</span>
          <div className="field-control">
            <input
              className="input"
              value={mineral}
              onChange={(event) => {
                clearConflict();
                setMineral(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSave(false);
                }
              }}
              placeholder="例如：Coal"
            />
          </div>
          <span className="field-hint">矿物名称会作为 `process` 表里的 key。</span>
        </label>

        <div className="process-builder__meta">
          <span className="chip chip--info">{countLabel(nodes.length)}</span>
          <span className="process-builder__hint">支持重复步骤，适合表示同一矿物的多阶段处理线路。</span>
        </div>

        {conflict ? (
          <section className="conflict-panel" aria-live="polite">
            <div className="conflict-panel__header">
              <h3 className="conflict-panel__title">矿物 “{conflict.mineral}” 已存在</h3>
              <p className="conflict-panel__description">请确认是否要用当前编辑内容替换已有流程。</p>
            </div>
            <div className="conflict-panel__grid">
              <div className="conflict-panel__card">
                <span className="conflict-panel__label">当前编辑流程</span>
                <StepPath steps={draftSteps} />
              </div>
              <div className="conflict-panel__card">
                <span className="conflict-panel__label">已有流程</span>
                <StepPath steps={conflict.steps} />
              </div>
            </div>
          </section>
        ) : null}

        <div className="process-builder__grid">
          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>可用职责</h3>
              <span>从当前配置自动同步</span>
            </div>
            <div className="palette">
              {availableSteps.length === 0 ? (
                <div className="empty-state empty-state--compact">暂无可用职责</div>
              ) : (
                availableSteps.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className="palette-card"
                    draggable
                    onDragStart={(event) => {
                      dragSourceRef.current = { kind: 'palette', step };
                      event.dataTransfer.effectAllowed = 'copyMove';
                      event.dataTransfer.setData('text/plain', step);
                    }}
                    onDragEnd={() => {
                      dragSourceRef.current = null;
                      setActiveSlotIndex(null);
                    }}
                    onClick={() => insertNodeAt(step, nodes.length)}
                  >
                    <span className="palette-card__name">{step}</span>
                    <span className="palette-card__tip">拖拽或点击添加</span>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="builder-panel builder-panel--sequence">
            <div className="builder-panel__header">
              <h3>流程线</h3>
              <span>拖拽卡片调整顺序</span>
            </div>

            <div className="flow-rail">
              <FlowSlot
                index={0}
                active={activeSlotIndex === 0}
                onDropAt={handleDropAt}
                onDragEnterAt={(index) => setActiveSlotIndex(index)}
              />

              {nodes.map((node, index) => (
                <Fragment key={node.id}>
                  <div
                    className="flow-node"
                    draggable
                    onDragStart={(event) => {
                      dragSourceRef.current = { kind: 'node', id: node.id };
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', node.id);
                    }}
                    onDragEnd={() => {
                      dragSourceRef.current = null;
                      setActiveSlotIndex(null);
                    }}
                  >
                    <span className="flow-node__name">{node.step}</span>
                    <button
                      type="button"
                      className="flow-node__remove"
                      onClick={() => removeNode(node.id)}
                      aria-label={`删除 ${node.step}`}
                    >
                      ×
                    </button>
                  </div>

                  <FlowSlot
                    index={index + 1}
                    active={activeSlotIndex === index + 1}
                    onDropAt={handleDropAt}
                    onDragEnterAt={(slotIndex) => setActiveSlotIndex(slotIndex)}
                  />
                </Fragment>
              ))}
            </div>

            {nodes.length === 0 ? (
              <div className="empty-state empty-state--compact">把职责拖到这里开始搭建流程。</div>
            ) : null}
          </section>
        </div>
      </div>
    </Modal>
  );
}
