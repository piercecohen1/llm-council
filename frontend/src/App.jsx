import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import CouncilConfigModal from './components/CouncilConfigModal';
import { api } from './api';
import './App.css';

const WEB_SEARCH_STORAGE_KEY = 'llm-council.webSearchEnabled';
const ACTIVE_COUNCIL_STORAGE_KEY = 'llm-council.activeCouncilId';

function App() {
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [currentConversation, setCurrentConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(() => {
    const stored = localStorage.getItem(WEB_SEARCH_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  });
  const [councilConfigs, setCouncilConfigs] = useState([]);
  const [activeConfig, setActiveConfig] = useState(null);
  const [councilModalOpen, setCouncilModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(WEB_SEARCH_STORAGE_KEY, String(webSearchEnabled));
  }, [webSearchEnabled]);

  useEffect(() => {
    (async () => {
      try {
        const configs = await api.listCouncilConfigs();
        setCouncilConfigs(configs);
        const savedId = localStorage.getItem(ACTIVE_COUNCIL_STORAGE_KEY);
        const match = savedId ? configs.find((c) => c.id === savedId) : null;
        if (match) setActiveConfig(match);
      } catch (e) {
        console.error('Failed to load council configs:', e);
      }
    })();
  }, []);

  const handleApplyCouncilConfig = (config) => {
    setActiveConfig(config);
    if (config?.id) {
      localStorage.setItem(ACTIVE_COUNCIL_STORAGE_KEY, config.id);
    } else {
      localStorage.removeItem(ACTIVE_COUNCIL_STORAGE_KEY);
    }
    api.listCouncilConfigs().then(setCouncilConfigs).catch(() => {});
  };

  const handleClearCouncilConfig = () => {
    setActiveConfig(null);
    localStorage.removeItem(ACTIVE_COUNCIL_STORAGE_KEY);
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (currentConversationId) {
      loadConversation(currentConversationId);
    } else {
      setCurrentConversation(null);
    }
  }, [currentConversationId]);

  const loadConversations = async () => {
    try {
      const convs = await api.listConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const handleNewConversation = async () => {
    try {
      const newConv = await api.createConversation();
      setConversations([
        {
          id: newConv.id,
          created_at: newConv.created_at,
          title: newConv.title,
          archived: false,
          message_count: 0,
        },
        ...conversations,
      ]);
      setCurrentConversationId(newConv.id);
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const handleSelectConversation = (id) => {
    setCurrentConversationId(id);
  };

  const handleArchiveConversation = async (id, archived) => {
    try {
      await api.setConversationArchived(id, archived);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, archived } : c))
      );
      // If archiving the open conversation, close it.
      if (archived && currentConversationId === id) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to update archive state:', error);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (currentConversationId === id) {
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleSendMessage = async (content) => {
    if (!currentConversationId) return;

    setIsLoading(true);
    try {
      const userMessage = { role: 'user', content };
      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, userMessage],
      }));

      const assistantMessage = {
        role: 'assistant',
        stage1: null,
        stage2: null,
        stage3: null,
        metadata: null,
        loading: {
          stage1: false,
          stage2: false,
          stage3: false,
        },
      };

      setCurrentConversation((prev) => ({
        ...prev,
        messages: [...prev.messages, assistantMessage],
      }));

      await api.sendMessageStream(
        currentConversationId,
        content,
        (eventType, event) => {
          switch (eventType) {
            case 'stage1_start':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.loading.stage1 = true;
                return { ...prev, messages };
              });
              break;
            case 'stage1_complete':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.stage1 = event.data;
                lastMsg.loading.stage1 = false;
                return { ...prev, messages };
              });
              break;
            case 'stage2_start':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.loading.stage2 = true;
                return { ...prev, messages };
              });
              break;
            case 'stage2_complete':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.stage2 = event.data;
                lastMsg.metadata = event.metadata;
                lastMsg.loading.stage2 = false;
                return { ...prev, messages };
              });
              break;
            case 'stage3_start':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.loading.stage3 = true;
                return { ...prev, messages };
              });
              break;
            case 'stage3_complete':
              setCurrentConversation((prev) => {
                const messages = [...prev.messages];
                const lastMsg = messages[messages.length - 1];
                lastMsg.stage3 = event.data;
                lastMsg.loading.stage3 = false;
                return { ...prev, messages };
              });
              break;
            case 'title_complete':
              loadConversations();
              break;
            case 'complete':
              loadConversations();
              setIsLoading(false);
              break;
            case 'error':
              console.error('Stream error:', event.message);
              setIsLoading(false);
              break;
            default:
              console.log('Unknown event type:', eventType);
          }
        },
        {
          enableWebSearch: webSearchEnabled,
          councilModels: activeConfig?.council_models ?? null,
          chairmanModel: activeConfig?.chairman_model ?? null,
          reasoningConfigs: activeConfig?.reasoning_configs ?? null,
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      setCurrentConversation((prev) => ({
        ...prev,
        messages: prev.messages.slice(0, -2),
      }));
      setIsLoading(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onArchiveConversation={handleArchiveConversation}
        onDeleteConversation={handleDeleteConversation}
        councilConfigs={councilConfigs}
        activeConfig={activeConfig}
        onOpenCouncilModal={() => setCouncilModalOpen(true)}
        onSelectCouncilConfig={handleApplyCouncilConfig}
        onClearCouncilConfig={handleClearCouncilConfig}
      />
      <ChatInterface
        conversation={currentConversation}
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        webSearchEnabled={webSearchEnabled}
        onToggleWebSearch={setWebSearchEnabled}
      />
      <CouncilConfigModal
        open={councilModalOpen}
        onClose={() => setCouncilModalOpen(false)}
        onApplyConfig={handleApplyCouncilConfig}
        activeConfigId={activeConfig?.id ?? null}
      />
    </div>
  );
}

export default App;
