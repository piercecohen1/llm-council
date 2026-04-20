import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import Citations from './Citations';
import './Stage1.css';

export default function Stage1({ responses }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!responses || responses.length === 0) {
    return null;
  }

  const active = responses[activeTab];

  return (
    <div className="stage stage1">
      <h3 className="stage-title">Stage 1: Individual Responses</h3>

      <div className="tabs">
        {responses.map((resp, index) => (
          <button
            key={index}
            className={`tab ${activeTab === index ? 'active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            {resp.model.split('/')[1] || resp.model}
            {resp.citations && resp.citations.length > 0 && (
              <span className="tab-web-badge" title="Used web search">🌐</span>
            )}
          </button>
        ))}
      </div>

      <div className="tab-content">
        <div className="model-name">{active.model}</div>
        <div className="response-text markdown-content">
          <ReactMarkdown>{active.response}</ReactMarkdown>
        </div>
        <Citations
          citations={active.citations}
          searchCount={active.web_search_requests}
        />
      </div>
    </div>
  );
}
