import { useEffect, useRef, useState } from 'react';
import {
  formatResourceDisplay,
  getResourceSelectionValue,
  type ResourceRecord,
  type ResourceSelectionMode
} from '../../lib/resourceDatabase';

const VIRTUAL_ROW_HEIGHT = 96;
const VIRTUAL_OVERSCAN = 6;

function useVirtualWindow(itemCount: number, rowHeight: number, overscan: number) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState({ scrollTop: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return undefined;
    }

    const updateViewport = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = null;
      setViewport({
        scrollTop: element.scrollTop,
        height: element.clientHeight
      });
    };

    const scheduleViewportUpdate = () => {
      if (frameRef.current !== null) {
        return;
      }

      frameRef.current = window.requestAnimationFrame(updateViewport);
    };

    scheduleViewportUpdate();

    element.addEventListener('scroll', scheduleViewportUpdate, { passive: true });

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            scheduleViewportUpdate();
          })
        : null;

    resizeObserver?.observe(element);

    const handleWindowResize = () => scheduleViewportUpdate();
    window.addEventListener('resize', handleWindowResize);

    return () => {
      element.removeEventListener('scroll', scheduleViewportUpdate);
      resizeObserver?.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [itemCount, rowHeight, overscan]);

  const startIndex = Math.max(0, Math.floor(viewport.scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((viewport.scrollTop + viewport.height) / rowHeight) + overscan
  );

  return {
    containerRef,
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * rowHeight,
    bottomSpacerHeight: Math.max(0, (itemCount - endIndex) * rowHeight)
  };
}

function matchesSelectedValue(record: ResourceRecord, value: string, mode: ResourceSelectionMode): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  if (mode === 'label') {
    return record.localizedName === trimmed || record.key === trimmed;
  }

  return record.key === trimmed || record.internalName === trimmed || record.localizedName === trimmed;
}

export interface ResourcePickerVirtualListProps {
  records: readonly ResourceRecord[];
  recordIndices: Uint32Array;
  currentValue: string;
  valueMode: ResourceSelectionMode;
  onSelect: (nextValue: string, record: ResourceRecord) => void;
  formatSubtitle: (record: ResourceRecord) => string;
  formatDetail: (record: ResourceRecord) => string;
}

export function ResourcePickerVirtualList({
  records,
  recordIndices,
  currentValue,
  valueMode,
  onSelect,
  formatSubtitle,
  formatDetail
}: ResourcePickerVirtualListProps) {
  const { containerRef, startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = useVirtualWindow(
    recordIndices.length,
    VIRTUAL_ROW_HEIGHT,
    VIRTUAL_OVERSCAN
  );

  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 });
  }, [containerRef, recordIndices]);

  const visibleIndices = Array.from(recordIndices.slice(startIndex, endIndex));

  return (
    <div className="resource-picker-modal__list" ref={containerRef}>
      <div style={{ height: topSpacerHeight }} aria-hidden="true" />

      {visibleIndices.map((recordIndex) => {
        const record = records[recordIndex];
        if (!record) {
          return null;
        }

        const isSelected = matchesSelectedValue(record, currentValue, valueMode);
        const selectionValue = getResourceSelectionValue(record, valueMode);
        let title = record.displayName;
        if ('tooltip' in record) {
          title += '\n\n' + record.tooltip;
        }

        return (
          <button
            key={record.key}
            type="button"
            className={`resource-picker-modal__result${isSelected ? ' is-selected' : ''}`}
            onClick={() => onSelect(selectionValue, record)}
            title={title}
          >
            <span className="resource-picker-modal__result-title">{formatResourceDisplay(record)}</span>
            <span className="resource-picker-modal__result-subtitle">{formatSubtitle(record)}</span>
            <span className="resource-picker-modal__result-detail">{formatDetail(record)}</span>
          </button>
        );
      })}

      <div style={{ height: bottomSpacerHeight }} aria-hidden="true" />
    </div>
  );
}
