import { useEffect, useRef, useState } from 'react';
import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onArchiveConversation,
  onDeleteConversation,
  councilConfigs = [],
  activeConfig,
  onOpenCouncilModal,
  onSelectCouncilConfig,
  onClearCouncilConfig,
}) {
  const [menuOpenFor, setMenuOpenFor] = useState(null);
  const [confirmDeleteFor, setConfirmDeleteFor] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const activeLabel = activeConfig?.name || 'Default chamber';

  const active = conversations.filter((c) => !c.archived);
  const archived = conversations.filter((c) => c.archived);

  const handleSelectChange = (e) => {
    const value = e.target.value;
    if (value === '__default__') {
      onClearCouncilConfig?.();
      return;
    }
    const cfg = councilConfigs.find((c) => c.id === value);
    if (cfg) onSelectCouncilConfig?.(cfg);
  };

  // Close any open popovers when clicking elsewhere.
  const sidebarRef = useRef(null);
  useEffect(() => {
    const onDocClick = (e) => {
      if (!sidebarRef.current) return;
      if (!sidebarRef.current.contains(e.target)) {
        setMenuOpenFor(null);
        setConfirmDeleteFor(null);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const renderItem = (conv) => {
    const isActive = conv.id === currentConversationId;
    const isMenu = menuOpenFor === conv.id;
    const isConfirm = confirmDeleteFor === conv.id;

    return (
      <li key={conv.id} className={`conv ${isActive ? 'conv--active' : ''} ${conv.archived ? 'conv--archived' : ''}`}>
        <button
          type="button"
          className="conv__main"
          onClick={() => onSelectConversation(conv.id)}
        >
          <span className="conv__title">{conv.title || 'Untitled'}</span>
          <span className="conv__meta">
            {conv.message_count === 0
              ? 'Empty'
              : conv.message_count === 1
              ? '1 exchange'
              : `${Math.ceil(conv.message_count / 2)} exchanges`}
          </span>
        </button>

        <button
          type="button"
          className={`conv__more ${isMenu ? 'is-open' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDeleteFor(null);
            setMenuOpenFor(isMenu ? null : conv.id);
          }}
          aria-label="Conversation actions"
          title="Actions"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <circle cx="2.5" cy="7" r="1.3" fill="currentColor" />
            <circle cx="7" cy="7" r="1.3" fill="currentColor" />
            <circle cx="11.5" cy="7" r="1.3" fill="currentColor" />
          </svg>
        </button>

        {isMenu && !isConfirm && (
          <div className="conv__menu" role="menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="conv__menu-item"
              onClick={() => {
                onArchiveConversation(conv.id, !conv.archived);
                setMenuOpenFor(null);
              }}
            >
              <span className="conv__menu-glyph" aria-hidden="true">
                {conv.archived ? '↩' : '❖'}
              </span>
              {conv.archived ? 'Restore from archive' : 'Archive'}
            </button>
            <button
              type="button"
              className="conv__menu-item conv__menu-item--danger"
              onClick={() => setConfirmDeleteFor(conv.id)}
            >
              <span className="conv__menu-glyph" aria-hidden="true">✕</span>
              Delete permanently
            </button>
          </div>
        )}

        {isConfirm && (
          <div className="conv__menu conv__menu--confirm" onClick={(e) => e.stopPropagation()}>
            <div className="conv__confirm-text">
              Delete this conversation? <em>This cannot be undone.</em>
            </div>
            <div className="conv__confirm-actions">
              <button
                type="button"
                className="conv__confirm-btn conv__confirm-btn--ghost"
                onClick={() => {
                  setConfirmDeleteFor(null);
                  setMenuOpenFor(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="conv__confirm-btn conv__confirm-btn--danger"
                onClick={() => {
                  onDeleteConversation(conv.id);
                  setConfirmDeleteFor(null);
                  setMenuOpenFor(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </li>
    );
  };

  return (
    <aside className="sidebar" ref={sidebarRef}>
      <div className="sidebar__brand">
        <div className="sidebar__mark" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L3 7v5c0 5.25 3.75 9.75 9 11 5.25-1.25 9-5.75 9-11V7l-9-5z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
            <path d="M7.5 11h9M7.5 14h9M9.5 17h5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </div>
        <div className="sidebar__wordmark">
          <div className="sidebar__title">LLM Council</div>
          <div className="sidebar__subtitle">Chambers</div>
        </div>
      </div>

      <button
        type="button"
        className="sidebar__compose"
        onClick={onNewConversation}
      >
        <span className="sidebar__compose-plus" aria-hidden="true">＋</span>
        Open a new matter
      </button>

      <section className="sidebar__section">
        <div className="sidebar__section-head">
          <span className="eyebrow">The Chamber</span>
        </div>
        <div className="sidebar__council-card">
          <div className="sidebar__council-name">{activeLabel}</div>
          <div className="sidebar__council-controls">
            <select
              className="sidebar__council-select"
              value={activeConfig?.id || '__default__'}
              onChange={handleSelectChange}
              aria-label="Select council configuration"
            >
              <option value="__default__">Default chamber</option>
              {councilConfigs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="sidebar__council-configure"
              onClick={onOpenCouncilModal}
              title="Configure councils"
            >
              Configure
            </button>
          </div>
        </div>
      </section>

      <section className="sidebar__section sidebar__section--list">
        <div className="sidebar__section-head">
          <span className="eyebrow">Dockets</span>
          <span className="sidebar__count">{active.length}</span>
        </div>
        {active.length === 0 ? (
          <div className="sidebar__empty">No open matters.</div>
        ) : (
          <ul className="conv-list">{active.map(renderItem)}</ul>
        )}

        {archived.length > 0 && (
          <>
            <button
              type="button"
              className={`sidebar__archive-toggle ${archiveOpen ? 'is-open' : ''}`}
              onClick={() => setArchiveOpen((o) => !o)}
            >
              <span className="sidebar__archive-chevron" aria-hidden="true">
                {archiveOpen ? '▾' : '▸'}
              </span>
              <span className="eyebrow">Archive</span>
              <span className="sidebar__count">{archived.length}</span>
            </button>
            {archiveOpen && <ul className="conv-list conv-list--archived">{archived.map(renderItem)}</ul>}
          </>
        )}
      </section>
    </aside>
  );
}
