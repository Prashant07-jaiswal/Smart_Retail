const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e2b';
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 4000;

router.post('/', authenticate, authorize('owner'), async (req, res) => {
  const suppliedMessages = req.body && req.body.messages;

  if (!Array.isArray(suppliedMessages) || suppliedMessages.length === 0) {
    return res.status(400).json({ error: 'Send a messages array containing your chat message.' });
  }

  const messages = suppliedMessages.slice(-MAX_MESSAGES).map((message) => {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') {
      return null;
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    return { role: message.role, content };
  });

  if (messages.some((message) => message === null) || messages[messages.length - 1]?.role !== 'user') {
    return res.status(400).json({ error: 'Messages must contain valid user/assistant text and end with a user message.' });
  }

  if (typeof fetch !== 'function') {
    return res.status(500).json({ error: 'This backend needs Node.js 18 or newer to connect to Ollama.' });
  }

  const ollamaMessages = [
    {
      role: 'system',
      content: 'You are a helpful, concise AI chat assistant for a small retail store owner. Answer clearly and honestly. You do not have access to live store data unless the user includes it in the conversation. Never claim to have checked the application database or performed actions.'
    },
    ...messages
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const modelMissing = response.status === 404 || /model.*not found/i.test(detail);
      return res.status(502).json({
        error: modelMissing
          ? `Ollama could not find model "${OLLAMA_MODEL}". Check it with: ollama list`
          : 'Gemma could not respond. Make sure Ollama is running and try again.'
      });
    }

    const result = await response.json();
    const reply = result && result.message && result.message.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      return res.status(502).json({ error: 'Gemma returned an empty response. Please try again.' });
    }

    return res.json({ reply: reply.trim() });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Gemma took too long to respond. Please try again.' });
    }
    return res.status(502).json({ error: 'Cannot connect to Ollama. Make sure Ollama is running on this machine.' });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;
