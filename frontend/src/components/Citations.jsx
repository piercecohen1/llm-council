import './Citations.css';

export default function Citations({ citations, searchCount }) {
  if (!citations || citations.length === 0) {
    return null;
  }

  const seen = new Set();
  const unique = citations.filter((c) => {
    if (!c?.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  return (
    <div className="citations">
      <div className="citations-header">
        Sources{typeof searchCount === 'number' && searchCount > 0
          ? ` (${searchCount} search${searchCount === 1 ? '' : 'es'})`
          : ''}
      </div>
      <ol className="citations-list">
        {unique.map((c, i) => (
          <li key={i} className="citation-item">
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="citation-link"
              title={c.url}
            >
              {c.title || c.url}
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
