import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import './CouncilConfigModal.css';

const REASONING_LEVELS = [
  { value: 'default', label: 'Default' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'xhigh', label: 'Extra High' },
  { value: 'off', label: 'Off' },
];

function reasoningToLevel(reasoning) {
  if (!reasoning) return 'default';
  if (reasoning.enabled === false) return 'off';
  if (reasoning.effort === 'none') return 'off';
  return reasoning.effort || 'default';
}

function levelToReasoning(level) {
  if (level === 'default') return null;
  if (level === 'off') return { enabled: false };
  return { effort: level };
}

function formatPrice(priceStr) {
  if (priceStr === undefined || priceStr === null || priceStr === '') return null;
  const n = Number(priceStr);
  if (!Number.isFinite(n) || n === 0) return null;
  const perMillion = n * 1_000_000;
  return `$${perMillion < 1 ? perMillion.toFixed(3) : perMillion.toFixed(2)}/M`;
}

function modelSubtitle(model) {
  const ctx = model.context_length ? `${(model.context_length / 1000).toFixed(0)}k ctx` : null;
  const pIn = formatPrice(model.pricing?.prompt);
  const pOut = formatPrice(model.pricing?.completion);
  const priceBits = [pIn && `in ${pIn}`, pOut && `out ${pOut}`].filter(Boolean).join(' · ');
  return [ctx, priceBits].filter(Boolean).join(' · ');
}

export default function CouncilConfigModal({
  open,
  onClose,
  onApplyConfig,
  activeConfigId,
}) {
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState(null);

  const [configs, setConfigs] = useState([]);
  const [editingId, setEditingId] = useState(null); // null means "new / unsaved"
  const [name, setName] = useState('');
  const [selectedModels, setSelectedModels] = useState([]); // array of model ids
  const [chairmanModel, setChairmanModel] = useState('');
  const [reasoningConfigs, setReasoningConfigs] = useState({}); // {modelId: reasoning}

  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaults, setDefaults] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setModelsLoading(true);
    setModelsError(null);
    Promise.all([api.listModels(), api.listCouncilConfigs(), api.getDefaults()])
      .then(([m, c, d]) => {
        if (cancelled) return;
        setModels(m);
        setConfigs(c);
        setDefaults(d);
      })
      .catch((e) => {
        if (!cancelled) setModelsError(e.message || 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // When modal opens, initialize editor with active config or defaults.
  useEffect(() => {
    if (!open || !defaults) return;
    const active = configs.find((c) => c.id === activeConfigId);
    if (active) {
      loadConfigIntoEditor(active);
    } else if (editingId === null && selectedModels.length === 0) {
      loadDefaultsIntoEditor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaults, configs.length]);

  function loadConfigIntoEditor(cfg) {
    setEditingId(cfg.id);
    setName(cfg.name || '');
    setSelectedModels(cfg.council_models || []);
    setChairmanModel(cfg.chairman_model || '');
    setReasoningConfigs(cfg.reasoning_configs || {});
  }

  function loadDefaultsIntoEditor() {
    setEditingId(null);
    setName('');
    setSelectedModels(defaults?.council_models || []);
    setChairmanModel(defaults?.chairman_model || '');
    setReasoningConfigs({});
  }

  function startNewConfig() {
    loadDefaultsIntoEditor();
  }

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return models;
    return models.filter((m) => {
      const hay = `${m.id} ${m.name} ${m.description}`.toLowerCase();
      return hay.includes(q);
    });
  }, [models, search]);

  // Always include selected models at the top even if they don't match the search.
  const listToRender = useMemo(() => {
    const selectedSet = new Set(selectedModels);
    const selectedFirst = models.filter((m) => selectedSet.has(m.id));
    const rest = filteredModels.filter((m) => !selectedSet.has(m.id));
    return [...selectedFirst, ...rest];
  }, [models, filteredModels, selectedModels]);

  function toggleModel(id) {
    setSelectedModels((prev) => {
      if (prev.includes(id)) {
        // removing: if it was the chair, clear chair
        if (chairmanModel === id) setChairmanModel('');
        return prev.filter((x) => x !== id);
      }
      return [...prev, id];
    });
  }

  function setReasoningLevel(id, level) {
    setReasoningConfigs((prev) => {
      const next = { ...prev };
      const val = levelToReasoning(level);
      if (val === null) delete next[id];
      else next[id] = val;
      return next;
    });
  }

  function handleSetChair(id) {
    // Ensure chair is part of selectedModels (chair runs Stage 3).
    setSelectedModels((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setChairmanModel(id);
  }

  async function handleSave({ asNew = false } = {}) {
    if (!name.trim()) {
      alert('Give this council a name before saving.');
      return;
    }
    if (selectedModels.length === 0) {
      alert('Pick at least one council member.');
      return;
    }
    if (!chairmanModel) {
      alert('Pick a chair.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        councilModels: selectedModels,
        chairmanModel,
        reasoningConfigs,
      };
      let saved;
      if (asNew || !editingId) {
        saved = await api.createCouncilConfig(payload);
      } else {
        saved = await api.updateCouncilConfig(editingId, payload);
      }
      const refreshed = await api.listCouncilConfigs();
      setConfigs(refreshed);
      setEditingId(saved.id);
    } catch (e) {
      alert(`Save failed: ${e.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editingId) return;
    if (!confirm('Delete this council config?')) return;
    try {
      await api.deleteCouncilConfig(editingId);
      const refreshed = await api.listCouncilConfigs();
      setConfigs(refreshed);
      loadDefaultsIntoEditor();
    } catch (e) {
      alert(`Delete failed: ${e.message || e}`);
    }
  }

  function handleApply() {
    if (selectedModels.length === 0 || !chairmanModel) {
      alert('Pick at least one council member and a chair.');
      return;
    }
    onApplyConfig({
      id: editingId,
      name: name || 'Unsaved council',
      council_models: selectedModels,
      chairman_model: chairmanModel,
      reasoning_configs: reasoningConfigs,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="council-modal-backdrop" onClick={onClose}>
      <div className="council-modal" onClick={(e) => e.stopPropagation()}>
        <div className="council-modal-header">
          <h2>Configure Council</h2>
          <button className="council-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="council-modal-body">
          <aside className="council-configs-panel">
            <div className="council-configs-header">
              <span>Saved councils</span>
              <button className="council-btn-ghost" onClick={startNewConfig}>+ New</button>
            </div>
            <ul className="council-configs-list">
              {configs.length === 0 && (
                <li className="council-configs-empty">No saved councils yet</li>
              )}
              {configs.map((c) => (
                <li
                  key={c.id}
                  className={`council-configs-item ${editingId === c.id ? 'active' : ''}`}
                  onClick={() => loadConfigIntoEditor(c)}
                >
                  <div className="council-configs-item-name">{c.name}</div>
                  <div className="council-configs-item-meta">
                    {c.council_models.length} models · chair: {c.chairman_model.split('/').pop()}
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          <section className="council-editor-panel">
            <div className="council-editor-top">
              <input
                className="council-name-input"
                type="text"
                placeholder="Council name (e.g. Max intelligence)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="council-editor-actions">
                <button
                  className="council-btn"
                  onClick={() => handleSave({ asNew: false })}
                  disabled={saving}
                >
                  {editingId ? 'Save' : 'Save new'}
                </button>
                {editingId && (
                  <button
                    className="council-btn-ghost"
                    onClick={() => handleSave({ asNew: true })}
                    disabled={saving}
                  >
                    Save as new
                  </button>
                )}
                {editingId && (
                  <button className="council-btn-danger" onClick={handleDelete}>
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="council-summary">
              <div className="council-summary-row">
                <span className="council-summary-label">Council ({selectedModels.length}):</span>
                <div className="council-summary-pills">
                  {selectedModels.length === 0 && <span className="council-muted">none selected</span>}
                  {selectedModels.map((id) => (
                    <span key={id} className={`council-pill ${chairmanModel === id ? 'is-chair' : ''}`}>
                      {chairmanModel === id && <span className="council-chair-badge">chair</span>}
                      {id}
                      <button
                        className="council-pill-remove"
                        onClick={() => toggleModel(id)}
                        aria-label={`Remove ${id}`}
                      >×</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="council-search-row">
              <input
                className="council-search"
                type="text"
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="council-count">
                {modelsLoading ? 'Loading…' : `${filteredModels.length} / ${models.length}`}
              </span>
            </div>

            {modelsError && <div className="council-error">{modelsError}</div>}

            <div className="council-model-list">
              {listToRender.map((m) => {
                const isSelected = selectedModels.includes(m.id);
                const isChair = chairmanModel === m.id;
                const level = reasoningToLevel(reasoningConfigs[m.id]);
                return (
                  <div
                    key={m.id}
                    className={`council-model-row ${isSelected ? 'selected' : ''}`}
                  >
                    <label className="council-model-check">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleModel(m.id)}
                      />
                    </label>
                    <div className="council-model-info">
                      <div className="council-model-name">{m.name}</div>
                      <div className="council-model-id">{m.id}</div>
                      <div className="council-model-meta">{modelSubtitle(m)}</div>
                    </div>
                    <div className="council-model-controls">
                      <label
                        className={`council-chair-toggle ${isChair ? 'active' : ''}`}
                        title="Set as chair (Stage 3 synthesizer)"
                      >
                        <input
                          type="radio"
                          name="chair"
                          checked={isChair}
                          onChange={() => handleSetChair(m.id)}
                        />
                        <span>Chair</span>
                      </label>
                      <select
                        className="council-reasoning-select"
                        value={level}
                        onChange={(e) => setReasoningLevel(m.id, e.target.value)}
                        title="Reasoning effort (sent as OpenRouter `reasoning.effort`; 'Default' omits the field)"
                        disabled={!isSelected}
                      >
                        {REASONING_LEVELS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="council-modal-footer">
          <button className="council-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="council-btn-primary" onClick={handleApply}>
            Use this council
          </button>
        </div>
      </div>
    </div>
  );
}
