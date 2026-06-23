import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import type { InterfaceEntry, RoleEntry } from '../../lib/OreConfigManager';
import { Section } from './common';

interface RoleSectionProps {
  roles: RoleEntry[];
  interfaces: InterfaceEntry[];
  onAddRole: () => void;
  onEditRole: (role: RoleEntry) => void;
  onDeleteRole: (name: string) => void;
  onDeleteInterface: (id: string) => void;
}

interface InterfaceSwipeItemProps {
  id: string;
  onDelete: (id: string) => void;
}

function InterfaceSwipeItem({ id, onDelete }: InterfaceSwipeItemProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [canSwipe, setCanSwipe] = useState(false);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const maxReveal = 88;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 640px)');
    const update = () => setCanSwipe(mediaQuery.matches);

    update();
    mediaQuery.addEventListener?.('change', update);
    return () => {
      mediaQuery.removeEventListener?.('change', update);
    };
  }, []);

  const settle = (nextOffset: number) => {
    const settled = nextOffset >= maxReveal * 0.45 ? maxReveal : 0;
    offsetRef.current = settled;
    setOffset(settled);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSwipe) {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    startXRef.current = event.clientX;
    startOffsetRef.current = offsetRef.current;
    setDragging(true);

    try {
      rowRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failures on older browsers.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSwipe || !dragging || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const delta = event.clientX - startXRef.current;
    const nextOffset = Math.max(0, Math.min(maxReveal, startOffsetRef.current + delta));
    offsetRef.current = nextOffset;
    setOffset(nextOffset);
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSwipe) {
      return;
    }

    if (pointerIdRef.current === event.pointerId) {
      try {
        rowRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Ignore capture release failures.
      }
    }

    pointerIdRef.current = null;
    setDragging(false);
    settle(offsetRef.current);
  };

  const handleDelete = () => {
    onDelete(id);
    offsetRef.current = 0;
    setOffset(0);
  };

  return (
    <div
      ref={rowRef}
      className="role-card__interface-item"
      style={{ '--interface-swipe-offset': `${offset}px` } as CSSProperties}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
    >
      <div className="role-card__interface-underlay">
        <button
          type="button"
          className="button button--danger button--compact role-card__interface-delete-mobile"
          disabled={offset === 0}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={handleDelete}
        >
          删除
        </button>
      </div>

      <div className={`role-card__interface-foreground${dragging ? ' is-dragging' : ''}`}>
        <span className="chip chip--soft role-card__interface-label">{id}</span>
        <button
          type="button"
          className="icon-button icon-button--inline role-card__interface-delete-desktop"
          onClick={handleDelete}
          aria-label={`删除ME接口 ${id}`}
          title={`删除ME接口 ${id}`}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function RoleSection({
  roles,
  interfaces,
  onAddRole,
  onEditRole,
  onDeleteRole,
  onDeleteInterface
}: RoleSectionProps) {
  const interfacesByRole = useMemo(() => {
    const map = new Map<string, InterfaceEntry[]>();

    for (const entry of interfaces) {
      const list = map.get(entry.role);
      if (list) {
        list.push(entry);
      } else {
        map.set(entry.role, [entry]);
      }
    }

    return map;
  }, [interfaces]);

  return (
    <Section
      title="职责列表"
      subtitle="职责名称、机器和它绑定的ME接口都在这里单独维护。"
      className="panel--tall"
      actions={
        <button type="button" className="button button--filled button--compact" onClick={onAddRole}>
          新增职责
        </button>
      }
    >
      <div className="scroll-stack">
        {roles.length === 0 ? (
          <div className="empty-state">暂无职责。</div>
        ) : (
          <div className="role-grid">
            {roles.map((role) => {
              const relatedInterfaces = interfacesByRole.get(role.name) || [];

              return (
                <article className="role-card" key={role.name}>
                  <div className="role-card__header">
                    <div>
                      <h4 className="role-card__title">{role.name}</h4>
                      <p className="role-card__meta">{role.machine}</p>
                    </div>
                    <div className="button-row">
                      <button
                        type="button"
                        className="button button--tonal button--compact"
                        onClick={() => onEditRole(role)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="button button--danger button--compact"
                        onClick={() => onDeleteRole(role.name)}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="role-card__body">
                    <span className="role-card__label">包含以下ME接口</span>
                    <div className="role-card__interface-list">
                      {relatedInterfaces.length === 0 ? (
                        <span className="empty-chip">无ME接口</span>
                      ) : (
                        relatedInterfaces.map((entry) => (
                          <InterfaceSwipeItem key={entry.id} id={entry.id} onDelete={onDeleteInterface} />
                        ))
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
