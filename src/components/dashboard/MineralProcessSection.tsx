import { useMemo, useState } from 'react';
import type { MineralProcess } from '../../lib/OreConfigManager';
import { Section, StepPath } from './common';
import type { ProcessSortMode, SortDirection } from './sortTypes';

interface MineralProcessSectionProps {
  processes: MineralProcess[];
  onAddProcess: () => void;
  onEditProcess: (process: MineralProcess) => void;
  onDeleteProcess: (mineral: string) => void;
}

const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

export function MineralProcessSection({
  processes,
  onAddProcess,
  onEditProcess,
  onDeleteProcess
}: MineralProcessSectionProps) {
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<ProcessSortMode>('length');
  const [sortDirection, setSortDirection] = useState<SortDirection>('default');

  const filteredProcesses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return processes;
    }

    return processes.filter((process) =>
      `${process.mineral} ${process.steps.join(' ')}`.toLowerCase().includes(query)
    );
  }, [processes, search]);

  const visibleProcesses = useMemo(() => {
    if (sortDirection === 'default') {
      return [...filteredProcesses];
    }

    return [...filteredProcesses].sort((left, right) => {
      let result = 0;

      if (sortMode === 'name') {
        result = COLLATOR.compare(left.mineral, right.mineral);
        if (result === 0) {
          result = left.steps.length - right.steps.length;
        }
      } else {
        result = left.steps.length - right.steps.length;
        if (result === 0) {
          result = COLLATOR.compare(left.mineral, right.mineral);
        }
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [filteredProcesses, sortDirection, sortMode]);

  const nextSortDirection: SortDirection =
    sortDirection === 'default' ? 'asc' : sortDirection === 'asc' ? 'desc' : 'default';
  const sortDirectionIcon = sortDirection === 'default' ? '\u2195' : sortDirection === 'asc' ? '\u2191' : '\u2193';
  const sortDirectionLabel =
    sortDirection === 'default' ? '默认排序' : sortDirection === 'asc' ? '正序排序' : '逆序排序';
  const nextSortDirectionLabel =
    nextSortDirection === 'default' ? '默认排序' : nextSortDirection === 'asc' ? '正序排序' : '逆序排序';

  return (
    <Section
      title="矿物处理流程"
      subtitle="按矿物浏览每条处理线，并支持搜索、排序和编辑。"
      className="panel--flow"
      actions={
        <div className="panel-actions-row">
          <input
            className="input input--search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索矿物 / 步骤"
          />
          <div className="sort-controls">
            <select
              className="input input--compact input--sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as ProcessSortMode)}
            >
              <option value="length">按工序长度</option>
              <option value="name">按矿物名称</option>
            </select>
            <button
              type="button"
              className="button button--tonal button--compact sort-direction-button"
              aria-label={`${sortDirectionLabel}，点击切换为${nextSortDirectionLabel}`}
              title={`${sortDirectionLabel}，点击切换为${nextSortDirectionLabel}`}
              onClick={() => setSortDirection(nextSortDirection)}
            >
              <span aria-hidden="true">{sortDirectionIcon}</span>
            </button>
          </div>
          <button type="button" className="button button--filled" onClick={onAddProcess}>
            新增流程
          </button>
        </div>
      }
    >
      <div className="scroll-stack">
        {visibleProcesses.length === 0 ? (
          <div className="empty-state">没有匹配的矿物流程。</div>
        ) : (
          visibleProcesses.map((process) => (
            <article className="record-card" key={process.mineral}>
              <div className="record-card__header">
                <div>
                  <h3 className="record-card__title">{process.mineral}</h3>
                  <p className="record-card__meta">{process.steps.length} 个步骤</p>
                </div>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--tonal button--compact"
                    onClick={() => onEditProcess(process)}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    className="button button--danger button--compact"
                    onClick={() => onDeleteProcess(process.mineral)}
                  >
                    删除
                  </button>
                </div>
              </div>
              <StepPath steps={process.steps} />
            </article>
          ))
        )}
      </div>
    </Section>
  );
}
