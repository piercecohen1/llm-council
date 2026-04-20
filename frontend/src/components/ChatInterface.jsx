import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import Stage1 from './Stage1';
import Stage2 from './Stage2';
import Stage3 from './Stage3';
import './ChatInterface.css';

export default function ChatInterface({
  conversation,
  onSendMessage,
  isLoading,
  webSearchEnabled,
  onToggleWebSearch,
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  };

  // —— No conversation selected ——
  if (!conversation) {
    return (
      <main className="chat">
        <div className="chat__empty chat__empty--hero">
          <div className="hero__eyebrow eyebrow">Since 2026</div>
          <h1 className="hero__title">
            A <em>deliberation</em> of minds,
            <br />
            convened on your behalf.
          </h1>
          <p className="hero__lede">
            Submit a matter. Each member of the council will draft an opinion.
            They will review each other, rank the reasoning, and the chair will
            deliver a ruling — with sources, when warranted.
          </p>
          <div className="hero__rule" aria-hidden="true" />
          <div className="hero__cta">
            Open a new matter from the chambers at left to begin.
          </div>
        </div>
      </main>
    );
  }

  const isEmpty = conversation.messages.length === 0;

  return (
    <main className="chat">
      <header className="chat__header">
        <div className="chat__header-inner">
          <div className="chat__header-title">
            {conversation.title || 'New matter'}
          </div>
          <div className="chat__header-meta eyebrow">
            {isEmpty ? 'Awaiting first brief' : 'In deliberation'}
          </div>
        </div>
      </header>

      <div className="chat__scroll">
        <div className="chat__column">
          {isEmpty ? (
            <div className="chat__empty">
              <h2 className="empty__title">The chamber is ready.</h2>
              <p className="empty__lede">
                Put your question to the council. Speak plainly — the finer the
                ambiguity, the richer the debate.
              </p>
            </div>
          ) : (
            conversation.messages.map((msg, index) => (
              <article key={index} className="turn">
                {msg.role === 'user' ? (
                  <section className="brief">
                    <div className="brief__label eyebrow">Brief · You</div>
                    <div className="brief__content markdown-content">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </section>
                ) : (
                  <section className="proceedings">
                    <div className="proceedings__label eyebrow">
                      Proceedings · The Council
                    </div>

                    {msg.loading?.stage1 && (
                      <StageLoading
                        numeral="I"
                        title="Opening Opinions"
                        note="Each member is drafting an independent reply."
                      />
                    )}
                    {msg.stage1 && <Stage1 responses={msg.stage1} />}

                    {msg.loading?.stage2 && (
                      <StageLoading
                        numeral="II"
                        title="Peer Review"
                        note="Members are evaluating and ranking one another, anonymously."
                      />
                    )}
                    {msg.stage2 && (
                      <Stage2
                        rankings={msg.stage2}
                        labelToModel={msg.metadata?.label_to_model}
                        aggregateRankings={msg.metadata?.aggregate_rankings}
                      />
                    )}

                    {msg.loading?.stage3 && (
                      <StageLoading
                        numeral="III"
                        title="The Ruling"
                        note="The chair is reconciling the opinions into a single decision."
                      />
                    )}
                    {msg.stage3 && <Stage3 finalResponse={msg.stage3} />}
                  </section>
                )}
              </article>
            ))
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer__row-top">
            <WebSearchToggle
              enabled={!!webSearchEnabled}
              onChange={onToggleWebSearch}
              disabled={isLoading}
            />
            <div className="composer__hint">
              <kbd>Enter</kbd> to submit · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line
            </div>
          </div>
          <div className="composer__row">
            <textarea
              ref={textareaRef}
              className="composer__input"
              placeholder="Put your question to the council…"
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={2}
            />
            <button
              type="submit"
              className="composer__submit"
              disabled={!input.trim() || isLoading}
              aria-label="Submit brief"
            >
              <span className="composer__submit-text">Submit</span>
              <span className="composer__submit-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function WebSearchToggle({ enabled, onChange, disabled }) {
  return (
    <label
      className={`web-toggle ${enabled ? 'is-on' : 'is-off'}`}
      title="Give each council member the openrouter:web_search server tool"
    >
      <input
        type="checkbox"
        checked={enabled}
        onChange={(e) => onChange?.(e.target.checked)}
        disabled={disabled}
      />
      <span className="web-toggle__track" aria-hidden="true">
        <span className="web-toggle__thumb" />
      </span>
      <span className="web-toggle__content">
        <span className="web-toggle__icon" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.1" />
            <ellipse cx="8" cy="8" rx="3" ry="6.5" stroke="currentColor" strokeWidth="1.1" />
            <path d="M1.5 8h13" stroke="currentColor" strokeWidth="1.1" />
          </svg>
        </span>
        <span className="web-toggle__label">Web search</span>
        <span className="web-toggle__state">{enabled ? 'On' : 'Off'}</span>
      </span>
    </label>
  );
}

function StageLoading({ numeral, title, note }) {
  return (
    <div className="stage-loading">
      <div className="stage-loading__numeral">{numeral}</div>
      <div className="stage-loading__body">
        <div className="stage-loading__title">{title}</div>
        <div className="stage-loading__note">{note}</div>
      </div>
      <div className="stage-loading__indicator" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
