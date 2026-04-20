/**
 * API client for the LLM Council backend.
 */

const API_BASE = 'http://localhost:8001';

export const api = {
  /**
   * List all conversations.
   */
  async listConversations() {
    const response = await fetch(`${API_BASE}/api/conversations`);
    if (!response.ok) {
      throw new Error('Failed to list conversations');
    }
    return response.json();
  },

  /**
   * Create a new conversation.
   */
  async createConversation() {
    const response = await fetch(`${API_BASE}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
  },

  /**
   * Get a specific conversation.
   */
  async getConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`
    );
    if (!response.ok) {
      throw new Error('Failed to get conversation');
    }
    return response.json();
  },

  /**
   * Archive or unarchive a conversation.
   */
  async setConversationArchived(conversationId, archived) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/archive`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived }),
      }
    );
    if (!response.ok) throw new Error('Failed to update archive state');
    return response.json();
  },

  /**
   * Permanently delete a conversation.
   */
  async deleteConversation(conversationId) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}`,
      { method: 'DELETE' }
    );
    if (!response.ok) throw new Error('Failed to delete conversation');
    return response.json();
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, content, {
    enableWebSearch = true,
    councilModels = null,
    chairmanModel = null,
    reasoningConfigs = null,
  } = {}) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          enable_web_search: enableWebSearch,
          council_models: councilModels,
          chairman_model: chairmanModel,
          reasoning_configs: reasoningConfigs,
        }),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  },

  /**
   * Send a message and receive streaming updates.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - The message content
   * @param {function} onEvent - Callback function for each event: (eventType, data) => void
   * @returns {Promise<void>}
   */
  async sendMessageStream(conversationId, content, onEvent, {
    enableWebSearch = true,
    councilModels = null,
    chairmanModel = null,
    reasoningConfigs = null,
  } = {}) {
    const response = await fetch(
      `${API_BASE}/api/conversations/${conversationId}/message/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          enable_web_search: enableWebSearch,
          council_models: councilModels,
          chairman_model: chairmanModel,
          reasoning_configs: reasoningConfigs,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          try {
            const event = JSON.parse(data);
            onEvent(event.type, event);
          } catch (e) {
            console.error('Failed to parse SSE event:', e);
          }
        }
      }
    }
  },

  /**
   * List all available OpenRouter models (proxied + cached by backend).
   */
  async listModels({ refresh = false } = {}) {
    const url = new URL(`${API_BASE}/api/models`);
    if (refresh) url.searchParams.set('refresh', 'true');
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to list models');
    const data = await response.json();
    return data.data || [];
  },

  /**
   * Fetch the default council + chair configured server-side (from config.py).
   */
  async getDefaults() {
    const response = await fetch(`${API_BASE}/api/defaults`);
    if (!response.ok) throw new Error('Failed to fetch defaults');
    return response.json();
  },

  /**
   * List all saved council configs.
   */
  async listCouncilConfigs() {
    const response = await fetch(`${API_BASE}/api/council-configs`);
    if (!response.ok) throw new Error('Failed to list council configs');
    return response.json();
  },

  /**
   * Save a new council config.
   */
  async createCouncilConfig({ name, councilModels, chairmanModel, reasoningConfigs = {} }) {
    const response = await fetch(`${API_BASE}/api/council-configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        council_models: councilModels,
        chairman_model: chairmanModel,
        reasoning_configs: reasoningConfigs,
      }),
    });
    if (!response.ok) throw new Error('Failed to create council config');
    return response.json();
  },

  /**
   * Update an existing council config.
   */
  async updateCouncilConfig(configId, { name, councilModels, chairmanModel, reasoningConfigs = {} }) {
    const response = await fetch(`${API_BASE}/api/council-configs/${configId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        council_models: councilModels,
        chairman_model: chairmanModel,
        reasoning_configs: reasoningConfigs,
      }),
    });
    if (!response.ok) throw new Error('Failed to update council config');
    return response.json();
  },

  /**
   * Delete a council config.
   */
  async deleteCouncilConfig(configId) {
    const response = await fetch(`${API_BASE}/api/council-configs/${configId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete council config');
    return response.json();
  },
};
