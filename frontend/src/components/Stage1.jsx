import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Citations from './Citations';
import './Stage1.css';

function shortName(model) {
  return model.split('/')[1] || model;
}

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  const active = responses[activeTab];

  return (
    <section className="stage stage--1">
      <header className="stage__header">
        <div className="stage__numeral">I</div>
        <div className="stage__meta">
          <h3 className="stage__title">Opening Opinions</h3>
          <p className="stage__dek">
            Each member drafts a reply without seeing the others.
          </p>
        </div>
      </header>

      <div className="tabs" role="tablist">
        {responses.map((resp, index) => {
          const hasCitations = resp.citations && resp.citations.length > 0;
          return (
            <button
              key={index}
              role="tab"
              aria-selected={activeTab === index}
              className={`tab ${activeTab === index ? 'tab--active' : ''}`}
              onClick={() => setActiveTab(index)}
            >
              <span className="tab__name">{shortName(resp.model)}</span>
              {hasCitations && (
                <span className="tab__badge" title="Used web search">
                  <WebGlyph />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="stage__panel">
        <div className="stage__panel-head">
          <span className="eyebrow">Member</span>
          <span className="stage__model-id">{active.model}</span>
        </div>
        <div className="stage__panel-body markdown-content">
          <ReactMarkdown>{active.response}</ReactMarkdown>
        </div>
        <Citations
          citations={active.citations}
          searchCount={active.web_search_requests}
        />
      </div>
    </section>
  );
}

function WebGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="2.8" ry="6.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.8 8h12.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
