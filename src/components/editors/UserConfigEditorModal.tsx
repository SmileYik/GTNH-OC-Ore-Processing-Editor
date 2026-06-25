import { useEffect, useState } from 'react';
import {
  type Config,
  CONFIG_LANGUAGE_OPTIONS,
  cloneConfig,
  createDefaultConfig,
  useConfig,
  useConfigDispatch
} from '../../config';
import { Modal } from '../Modal';
import { fieldRow } from './shared';

interface UserConfigEditorModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (next: Config) => void;
}

function createDraftFromConfig(config: Config): Config {
  return cloneConfig(config);
}

export function UserConfigEditorModal({ open, onClose, onSave }: UserConfigEditorModalProps) {
  const initial = useConfig();
  const dispatch = useConfigDispatch();
  const [draft, setDraft] = useState<Config>(() => createDraftFromConfig(initial));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft(createDraftFromConfig(initial));
    setError('');
  }, [open, initial]);

  const resetDraft = () => {
    setDraft(createDefaultConfig());
    setError('');
  };

  const save = () => {
    const game = draft.lang.game.trim();
    const display = draft.lang.display.trim();

    if (!game) {
      setError('游戏语言不能为空');
      return;
    }

    if (!display) {
      setError('展示语言不能为空');
      return;
    }

    const nextConfig: Config = {
      lang: {
        game,
        display
      },
      database: {
        autoLoadFluids: draft.database.autoLoadFluids,
        autoLoadItems: draft.database.autoLoadItems
      }
    };

    dispatch({
      type: 'replace',
      payload: nextConfig
    });
    onSave?.(nextConfig);
    onClose();
  };

  return (
    <Modal
      open={open}
      title="用户配置"
      subtitle="这里修改的是浏览器本地离线保存的用户配置，不会影响导出的 OC 配置文本。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--tonal" onClick={resetDraft}>
            恢复默认
          </button>
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
          '游戏语言',
          <select
            className="input"
            value={draft.lang.game}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                lang: {
                  ...current.lang,
                  game: event.target.value
                }
              }))
            }
          >
            {CONFIG_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>,
          '用于表示游戏资源所在的语言环境。'
        )}

        {fieldRow(
          '展示语言',
          <select
            className="input"
            value={draft.lang.display}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                lang: {
                  ...current.lang,
                  display: event.target.value
                }
              }))
            }
          >
            {CONFIG_LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>,
          '用于界面显示或后续扩展的语言环境。'
        )}

        {fieldRow(
          '自动加载流体数据库',
          <label className="export-panel__toggle rule-toggle">
            <input
              type="checkbox"
              checked={draft.database.autoLoadFluids}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  database: {
                    ...current.database,
                    autoLoadFluids: event.target.checked
                  }
                }))
              }
            />
            <span>启用时，打开页面后会自动预加载流体数据库。</span>
          </label>,
          '关闭后会按需加载，能减少首次打开的资源消耗。'
        )}

        {fieldRow(
          '自动加载物品数据库',
          <label className="export-panel__toggle rule-toggle">
            <input
              type="checkbox"
              checked={draft.database.autoLoadItems}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  database: {
                    ...current.database,
                    autoLoadItems: event.target.checked
                  }
                }))
              }
            />
            <span>启用时，打开页面后会自动预加载物品数据库。</span>
          </label>,
          '关闭后会按需加载，适合不常查询数据库的场景。'
        )}

        {error ? <div className="form-error">{error}</div> : null}
      </div>
    </Modal>
  );
}
