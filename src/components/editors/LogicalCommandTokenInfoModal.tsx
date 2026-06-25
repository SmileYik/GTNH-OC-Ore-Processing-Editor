import { useMemo } from 'react';
import type {
  LogicalCommandCacheState,
  LogicalExpressionCommandToken
} from '../../lib/logical/LogicalRules';
import {
  findLogicalCommandCacheEntry,
  formatLogicalCommandCacheItem,
  formatLogicalCommandSnapshot,
  getLogicalCommandDefinition
} from '../../lib/logical/LogicalRules';
import { Modal } from '../Modal';
import { fieldRow } from './shared';
import { useConfig } from '../../config';

interface LogicalCommandTokenInfoModalProps {
  open: boolean;
  token: LogicalExpressionCommandToken | null;
  cacheState: LogicalCommandCacheState;
  onClose: () => void;
}

export function LogicalCommandTokenInfoModal({
  open,
  token,
  cacheState,
  onClose
}: LogicalCommandTokenInfoModalProps) {
  const userConfig = useConfig();
  const selectedDefinition = useMemo(
    () => (token ? getLogicalCommandDefinition(token.name) : null),
    [token]
  );

  const selectedCacheItem = useMemo(() => {
    if (!token?.cacheId) {
      return null;
    }

    return findLogicalCommandCacheEntry(cacheState, token.cacheId);
  }, [cacheState, token]);

  if (!open || !token) {
    return null;
  }

  const footer = (
    <button type="button" className="button button--filled" onClick={onClose}>
      关闭
    </button>
  );

  return (
    <Modal
      open={open}
      title="命令信息"
      subtitle="查看当前命令节点的定义、参数和缓存关联。"
      sheetClassName="modal-sheet--logical-token"
      onClose={onClose}
      footer={footer}
    >
      <div className="logical-command-token-editor">
        {fieldRow(
          '命令名称',
          <code className="logical-rule-editor__preview mono">{token.name}</code>,
          selectedDefinition
            ? '这里显示当前节点保存的名称，可能是全名或别名。'
            : '自定义命令只显示当前保存的名称。'
        )}

        {fieldRow(
          selectedDefinition?.argsLabel ?? '参数',
          <code className="logical-rule-editor__preview mono">{token.args || '(无参数)'}</code>,
          selectedDefinition?.argsHint ?? '参数会原样传给执行器。'
        )}

        <div className="logical-command-token-editor__summary">
          <span className="chip chip--soft">{selectedDefinition?.label ?? '自定义命令'}</span>
          <span className="logical-command-token-editor__summary-text">
            {formatLogicalCommandSnapshot(token, userConfig.lang)}
          </span>
        </div>

        {selectedDefinition ? (
          <div className="logical-token-editor__definition">
            <strong>命令说明</strong>
            <p>{selectedDefinition.description}</p>
            <p>分类: {selectedDefinition.category}</p>
            <p>别名: {selectedDefinition.aliases.join(' / ') || '无'}</p>
          </div>
        ) : (
          <div className="logical-token-editor__definition">
            <strong>自定义命令</strong>
            <p>当前节点没有匹配到内置命令定义，只会展示原始名称和参数。</p>
          </div>
        )}

        {selectedCacheItem ? (
          <div className="logical-token-editor__definition">
            <strong>缓存关联</strong>
            <p>{selectedCacheItem.pinned ? '已固定缓存' : '自动缓存'}</p>
            <p className="mono">{selectedCacheItem.id}</p>
            <p>{formatLogicalCommandCacheItem(selectedCacheItem, userConfig.lang)}</p>
          </div>
        ) : (
          <div className="logical-token-editor__definition">
            <strong>缓存关联</strong>
            <p>当前节点没有链接到本地缓存实例。</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
