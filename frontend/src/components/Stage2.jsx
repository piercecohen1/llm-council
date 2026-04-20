import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import './Stage2.css';

function shortName(model) {
  return model.split('/')[1] || model;
}

function deAnonymizeText(text, labelToModel) {
  if (!labelToModel) return text;
  let result = text;
  Object.entries(labelToModel).forEach(([label, model]) => {
    result = result.replace(new RegExp(label, 'g'), `**${shortName(model)}**`);
  });
  return result;
}

export default function Stage2({ rankings, labelToModel, aggregateRankings }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!rankings || rankings.length === 0) {
    return null;
  }

  const active = rankings[activeTab];

  return (
    <section className="stage stage--2">
      <header className="stage__header">
        <div className="stage__numeral">II</div>
        <div className="stage__meta">
          <h3 className="stage__title">Peer Review</h3>
          <p className="stage__dek">
            Members evaluate one another anonymously as <em>Response A, B, C…</em>
            — identities are revealed below for your reading.
          </p>
        </div>
      </header>

      {aggregateRankings && aggregateRankings.length > 0 && (
        <div className="standings">
          <div className="standings__head">
            <span className="eyebrow">Standings</span>
            <span className="standings__note">Lower rank is better · averaged across all reviews</span>
          </div>
          <ol className="standings__list">
            {aggregateRankings.map((agg, index) => (
              <li key={index} className={`standings__item ${index === 0 ? 'standings__item--first' : ''}`}>
                <span className="standings__position">
                  {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][index] || `${index + 1}`}
                </span>
                <span className="standings__model">{shortName(agg.model)}</span>
                <span className="standings__score">
                  <span className="standings__score-val">{agg.average_rank.toFixed(2)}</span>
                  <span className="standings__score-count">
                    · {agg.rankings_count} {agg.rankings_count === 1 ? 'vote' : 'votes'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="tabs" role="tablist">
        {rankings.map((rank, index) => (
          <button
            key={index}
            role="tab"
            aria-selected={activeTab === index}
            className={`tab ${activeTab === index ? 'tab--active' : ''}`}
            onClick={() => setActiveTab(index)}
          >
            <span className="tab__name">{shortName(rank.model)}</span>
          </button>
        ))}
      </div>

      <div className="stage__panel">
        <div className="stage__panel-head">
          <span className="eyebrow">Review by</span>
          <span className="stage__model-id">{active.model}</span>
        </div>
        <div className="stage__panel-body markdown-content">
          <ReactMarkdown>
            {deAnonymizeText(active.ranking, labelToModel)}
          </ReactMarkdown>
        </div>

        {active.parsed_ranking && active.parsed_ranking.length > 0 && (
          <div className="parsed">
            <div className="parsed__label eyebrow">Extracted Ranking</div>
            <ol className="parsed__list">
              {active.parsed_ranking.map((label, i) => (
                <li key={i}>
                  {labelToModel && labelToModel[label]
                    ? shortName(labelToModel[label])
                    : label}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </section>
  );
}
