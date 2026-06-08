import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, title, subtitle, wide, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-sheet${wide ? ' modal-sheet--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <h2 className="modal-title">{title}</h2>
            {subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭弹窗">
            ×
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </div>
    </div>,
    document.body
  );
}
