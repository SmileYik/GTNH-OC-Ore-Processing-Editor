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

export function Notice({ tone, children, floating = false }: NoticeProps) {
  const className = [
    'notice',
    floating ? 'notice--floating' : 'notice--panel',
    `notice--${tone}`
  ].join(' ');

  return (
    <div className={className} role="status" aria-live="polite">
      {children}
    </div>
  );
}
