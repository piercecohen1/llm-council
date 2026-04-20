import ReactMarkdown from 'react-markdown';
import Citations from './Citations';
import './Stage3.css';

function shortName(model) {
  return model.split('/')[1] || model;
}

export default function Stage3({ finalResponse }) {
  if (!finalResponse) {
    return null;
  }

  return (
    <section className="stage stage--3">
      <header className="stage__header">
        <div className="stage__numeral">III</div>
        <div className="stage__meta">
          <h3 className="stage__title">The Ruling</h3>
          <p className="stage__dek">
            The chair reconciles the opinions into a single decision.
          </p>
        </div>
      </header>

      <article className="ruling">
        <div className="ruling__chop" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="17.5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="13" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
            <text
              x="20"
              y="25"
              textAnchor="middle"
              fontFamily="Fraunces, serif"
              fontSize="14"
              fontWeight="500"
              fill="currentColor"
              fontStyle="italic"
            >
              lc
            </text>
          </svg>
        </div>
        <div className="ruling__chair">
          <span className="eyebrow">Chair</span>
          <span className="ruling__chair-model">{shortName(finalResponse.model)}</span>
        </div>
        <div className="ruling__body markdown-content">
          <ReactMarkdown>{finalResponse.response}</ReactMarkdown>
        </div>
        <Citations
          citations={finalResponse.citations}
          searchCount={finalResponse.web_search_requests}
        />
      </article>
    </section>
  );
}
