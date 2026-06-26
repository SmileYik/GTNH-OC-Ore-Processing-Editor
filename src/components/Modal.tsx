import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import './Modal.css';

let modalScrollLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';
let previousHtmlOverflow = '';
let modalSequence = 0;
const modalStack: number[] = [];

function registerModal(): number {
  const modalId = modalSequence + 1;
  modalSequence = modalId;
  modalStack.push(modalId);
  return modalId;
}

function unregisterModal(modalId: number) {
  const index = modalStack.indexOf(modalId);
  if (index >= 0) {
    modalStack.splice(index, 1);
  }
}

function isTopModal(modalId: number): boolean {
  return modalStack[modalStack.length - 1] === modalId;
}

function lockDocumentScroll() {
  if (typeof document === 'undefined') {
    return;
  }

  if (modalScrollLockCount === 0) {
    const { body, documentElement } = document;
    previousBodyOverflow = body.style.overflow;
    previousBodyPaddingRight = body.style.paddingRight;
    previousHtmlOverflow = documentElement.style.overflow;

    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight || '0');
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }

    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';
  }

  modalScrollLockCount += 1;
}

function unlockDocumentScroll() {
  if (typeof document === 'undefined') {
    return;
  }

  modalScrollLockCount = Math.max(0, modalScrollLockCount - 1);

  if (modalScrollLockCount !== 0) {
    return;
  }

  const { body, documentElement } = document;
  body.style.overflow = previousBodyOverflow;
  body.style.paddingRight = previousBodyPaddingRight;
  documentElement.style.overflow = previousHtmlOverflow;
}

interface ModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  wide?: boolean;
  sheetClassName?: string;
  closeOnEscape?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({
  open,
  title,
  subtitle,
  wide,
  sheetClassName,
  closeOnEscape = true,
  onClose,
  children,
  footer
}: ModalProps) {
  const modalIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const modalId = registerModal();
    modalIdRef.current = modalId;
    lockDocumentScroll();
    return () => {
      unlockDocumentScroll();
      unregisterModal(modalId);
      if (modalIdRef.current === modalId) {
        modalIdRef.current = null;
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open || !closeOnEscape) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && modalIdRef.current !== null && isTopModal(modalIdRef.current)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, closeOnEscape, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`modal-sheet${wide ? ' modal-sheet--wide' : ''}${sheetClassName ? ` ${sheetClassName}` : ''}`}
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
