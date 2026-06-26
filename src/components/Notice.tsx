import { useEffect, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type NoticeTone = 'info' | 'success' | 'error';

export interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

export function useAutoDismissNotice<T>(
  notice: T | null,
  setNotice: Dispatch<SetStateAction<T | null>>,
  timeoutMs = 3000
) {
  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timer = window.setTimeout(() => setNotice(null), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice, timeoutMs]);
}

interface NoticeProps {
  tone: NoticeTone;
  children: ReactNode;
  floating?: boolean;
}

const NOTICE_META: Record<NoticeTone, { icon: string; title: string }> = {
  info: { icon: 'i', title: '提示' },
  success: { icon: 'OK', title: '已完成' },
  error: { icon: '!', title: '操作失败' }
};

export function Notice({ tone, children, floating = false }: NoticeProps) {
  const meta = NOTICE_META[tone];
  const className = [
    'notice',
    floating ? 'notice--floating' : 'notice--panel',
    `notice--${tone}`
  ].join(' ');

  return (
    <div className={className} role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      <div className="notice__icon" aria-hidden="true">
        {meta.icon}
      </div>
      <div className="notice__content">
        <strong className="notice__title">{meta.title}</strong>
        <div className="notice__text">{children}</div>
      </div>
    </div>
  );
}
