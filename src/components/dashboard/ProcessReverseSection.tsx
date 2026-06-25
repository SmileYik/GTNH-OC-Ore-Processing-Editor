import { useMemo, useState } from 'react';
import { formatProcessSignature, type ProcessReverseGroup } from '../../lib/OreConfigManager';
import { MineralTags, Section } from './common';
import type { ReverseSortMode, SortDirection } from './sortTypes';
import { useConfig } from '../../config';

interface ProcessReverseSectionProps {
  groups: ProcessReverseGroup[];
  onReuseProcess: (steps: string[]) => void;
}

const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

export function ProcessReverseSection({ groups, onReuseProcess }: ProcessReverseSectionProps) {
  const userConfig = useConfig();
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<ReverseSortMode>('length');
  const [sortDirection, setSortDirection] = useState<SortDirection>('default');

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return groups;
    }

    return groups.filter((group) =>
      `${group.signature} ${group.minerals.join(' ')}`.toLowerCase().includes(query)
    );
  }, [groups, search]);

  const visibleGroups = useMemo(() => {
    if (sortDirection === 'default') {
      return [...filteredGroups];
    }

    return [...filteredGroups].sort((left, right) => {
      let result = 0;

      if (sortMode === 'count') {
        result = left.minerals.length - right.minerals.length;
        if (result === 0) {
          result = COLLATOR.compare(left.signature, right.signature);
        }
        if (result === 0) {
          result = COLLATOR.compare(left.minerals.join(' / '), right.minerals.join(' / '));
        }
      } else {
        result = left.steps.length - right.steps.length;
        if (result === 0) {
          result = COLLATOR.compare(left.signature, right.signature);
        }
        if (result === 0) {
          result = COLLATOR.compare(left.minerals.join(' / '), right.minerals.join(' / '));
        }
      }

      return sortDirection === 'asc' ? result : -result;
    });
  }, [filteredGroups, sortDirection, sortMode]);

  const nextSortDirection: SortDirection =
    sortDirection === 'default' ? 'asc' : sortDirection === 'asc' ? 'desc' : 'default';
  const sortDirectionIcon = sortDirection === 'default' ? '\u2195' : sortDirection === 'asc' ? '\u2191' : '\u2193';
  const sortDirectionLabel =
    sortDirection === 'default' ? '默认排序' : sortDirection === 'asc' ? '正序排序' : '逆序排序';
  const nextSortDirectionLabel =
    nextSortDirection === 'default' ? '默认排序' : nextSortDirection === 'asc' ? '正序排序' : '逆序排序';

  return (
    <Section
      title="流程反查矿物"
      subtitle="根据当前处理顺序反向查看有哪些矿物会走同一条线。"
      className="panel--flow"
      actions={
        <div className="panel-actions-row">
          <input
            className="input input--search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="搜索流程 / 矿物"
          />
          <div className="sort-controls">
            <select
              className="input input--compact input--sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as ReverseSortMode)}
            >
              <option value="length">按工序长度</option>
              <option value="count">按矿物数量</option>
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
        </div>
      }
    >
      <div className="scroll-stack">
        {visibleGroups.length === 0 ? (
          <div className="empty-state">没有匹配的反查结果。</div>
        ) : (
          visibleGroups.map((group) => (
            <article className="record-card record-card--compact" key={group.signature || 'empty'}>
              <div className="record-card__header">
                <div>
                  <h3 className="record-card__title">
                    {group.signature ? formatProcessSignature(group.steps) : '空流程'}
                  </h3>
                  <p className="record-card__meta">{group.minerals.length} 个矿物</p>
                </div>
                <div className="button-row record-card__actions">
                  <button
                    type="button"
                    className="button button--filled button--compact"
                    disabled={group.steps.length === 0}
                    title={group.steps.length === 0 ? '空流程不可复用' : '使用这条流程新增矿物'}
                    onClick={() => onReuseProcess(group.steps)}
                  >
                    新增矿物
                  </button>
                </div>
              </div>
              <div className="record-card__scroll">
                <MineralTags minerals={group.minerals} lang={userConfig.lang} />
              </div>
            </article>
          ))
        )}
      </div>
    </Section>
  );
}
