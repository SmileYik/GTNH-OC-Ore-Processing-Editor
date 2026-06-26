import { useMemo, useState } from 'react';
import type { OreConfig } from '../../lib/OreConfig';
import { Notice, type NoticeMessage, useAutoDismissNotice } from '../Notice';
import { serializeOreConfig } from '../../lib/OreConfigManager';

interface ExportSectionProps {
  config: OreConfig;
  fileName: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function countFilterIds(groups: OreConfig['idWhitelist']): number {
  return Object.values(groups).reduce((sum, rule) => sum + Object.keys(rule).length, 0);
}

export function ExportSection({ config, fileName }: ExportSectionProps) {
  const [singleLine, setSingleLine] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const showNotice = (text: string, tone: NoticeMessage['tone'] = 'info') => {
    setNotice({ tone, text });
  };

  const exportText = useMemo(
    () => serializeOreConfig(config, { compact: singleLine }),
    [config, singleLine]
  );
  const whitelistCount = useMemo(() => countFilterIds(config.idWhitelist), [config]);
  const blacklistCount = useMemo(() => countFilterIds(config.idBlacklist), [config]);
  const downloadName = fileName.trim() || 'ore.config';

  useAutoDismissNotice(notice, setNotice, 3000);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      showNotice('已复制文本', 'success');
    } catch (error) {
      showNotice(`复制失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      link.click();
      URL.revokeObjectURL(url);
      showNotice(`已下载 ${downloadName}`, 'success');
    } catch (error) {
      showNotice(`下载失败: ${getErrorMessage(error)}`, 'error');
    }
  };

  return (
    <section className="export-panel">
      <div className="export-panel__header">
        <div>
          <h2>配置预览</h2>
          <p>当前配置的 Lua 文本预览、复制和下载都在这里完成。</p>
        </div>
        <div className="meta-pills meta-pills--right">
          <span className="chip chip--meta">白名单数量 {whitelistCount}</span>
          <span className="chip chip--meta">黑名单数量 {blacklistCount}</span>
        </div>
      </div>

      <div className="export-panel__toolbar">
        <label className="export-panel__toggle">
          <input
            type="checkbox"
            checked={singleLine}
            onChange={(event) => setSingleLine(event.target.checked)}
          />
          <span>单行显示</span>
        </label>

        <div className="button-row">
          <button type="button" className="button button--filled" onClick={handleCopy}>
            复制文本
          </button>
          <button type="button" className="button button--tonal" onClick={handleDownload}>
            下载文件
          </button>
        </div>
      </div>

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      <textarea className="export-textarea" value={exportText} readOnly spellCheck={false} />
    </section>
  );
}
