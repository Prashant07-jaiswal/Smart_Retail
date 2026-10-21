import { useEffect, useRef, useState } from 'react';
import { api, getErrorMessage } from '../services/api';
import './GemmaChatbot.css';

export default function GemmaChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      inputRef.current?.focus();
    }
  }, [open, messages, loading, error]);

  async function sendMessage(event) {
    event?.preventDefault();
    const content = input.trim();
    if (!content || loading) return;

    const nextMessages = [...messages, { role: 'user', content }].slice(-12);
    setMessages(nextMessages);
    setInput('');
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/chat', { messages: nextMessages });
      if (typeof data?.reply !== 'string' || !data.reply.trim()) {
        throw new Error('Gemma returned an empty response. Please try again.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: data.reply.trim() }].slice(-20));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function clearConversation() {
    if (loading) return;
    setMessages([]);
    setError('');
  }

  return (
    <div className="gemma-chatbot">
      {open && (
        <section className="gemma-chat-panel" aria-label="Gemma AI chat" aria-live="polite">
          <header className="gemma-chat-header">
            <div className="gemma-chat-avatar" aria-hidden="true">G</div>
            <div className="gemma-chat-heading">
              <strong>Gemma Assistant</strong>
              <span><i /> Local AI · Gemma 4</span>
            </div>
            <button className="gemma-chat-icon-button" type="button" onClick={clearConversation} disabled={loading} aria-label="Clear conversation" title="Clear conversation">↻</button>
            <button className="gemma-chat-icon-button" type="button" onClick={() => setOpen(false)} aria-label="Close chat" title="Close chat">×</button>
          </header>

          <div className="gemma-chat-messages" role="log" aria-label="Conversation messages">
            {messages.length === 0 && (
              <div className="gemma-chat-welcome">
                <div className="gemma-chat-welcome-icon" aria-hidden="true">✦</div>
                <strong>How can I help?</strong>
                <p>Ask me a question. I’m running locally through Ollama.</p>
              </div>
            )}
            {messages.map((message, index) => (
              <div className={`gemma-chat-row ${message.role === 'user' ? 'is-user' : 'is-assistant'}`} key={`${index}-${message.role}`}>
                <div className="gemma-chat-bubble">{message.content}</div>
              </div>
            ))}
            {loading && (
              <div className="gemma-chat-row is-assistant">
                <div className="gemma-chat-bubble gemma-chat-thinking"><span /><span /><span /><em>Thinking…</em></div>
              </div>
            )}
            {error && <div className="gemma-chat-error" role="alert">{error}</div>}
            <div ref={endRef} />
          </div>

          <form className="gemma-chat-composer" onSubmit={sendMessage}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Gemma anything…"
              aria-label="Message Gemma"
              rows={1}
              maxLength={4000}
              disabled={loading}
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send message" title="Send message">➤</button>
          </form>
          <div className="gemma-chat-footnote">AI can make mistakes. Verify important information.</div>
        </section>
      )}

      <button
        className={`gemma-chat-launcher ${open ? 'is-open' : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Close Gemma chat' : 'Open Gemma chat'}
        aria-expanded={open}
        title="Chat with Gemma"
      >
        {open ? '×' : <><span aria-hidden="true">✦</span><span className="gemma-chat-launcher-label">Ask Gemma</span></>}
      </button>
    </div>
  );
}
