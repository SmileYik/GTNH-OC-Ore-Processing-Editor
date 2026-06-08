interface ExportSectionProps {
  exportText: string;
  singleLine: boolean;
  onToggleSingleLine: (value: boolean) => void;
  onCopy: () => void;
  onDownload: () => void;
  whitelistCount: number;
  blacklistCount: number;
}

export function ExportSection({
  exportText,
  singleLine,
  onToggleSingleLine,
  onCopy,
  onDownload,
  whitelistCount,
  blacklistCount
}: ExportSectionProps) {
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
            onChange={(event) => onToggleSingleLine(event.target.checked)}
          />
          <span>单行显示</span>
        </label>

        <div className="button-row">
          <button type="button" className="button button--filled" onClick={onCopy}>
            复制文本
          </button>
          <button type="button" className="button button--tonal" onClick={onDownload}>
            下载文件
          </button>
        </div>
      </div>

      <textarea className="export-textarea" value={exportText} readOnly spellCheck={false} />
    </section>
  );
}
