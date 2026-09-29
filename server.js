import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

// ─── CHAT ROUTE ───
app.post('/api/chat', async (req, res) => {
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }

    res.end();

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── EMBEDDINGS ROUTE (Gemini) ───
app.post('/api/embeddings', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          content: { parts: [{ text: body.input }] },
          outputDimensionality: 768
        })
      }
    );

    const data = await response.json();
    console.log('Gemini status:', response.status);

    // Handle quota exceeded
    if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
      console.error('Gemini quota exceeded');
      return res.status(429).json({
        error: 'Gemini daily quota exceeded. Please wait until midnight Pacific Time for reset.'
      });
    }

    // Handle any other Gemini error
    if (data?.error) {
      console.error('Gemini error:', JSON.stringify(data.error));
      return res.status(500).json({ error: data.error.message });
    }

    if (!data?.embedding?.values) {
      console.error('No embedding in response:', JSON.stringify(data));
      return res.status(500).json({ error: 'No embedding returned from Gemini' });
    }

    res.status(200).json({
      data: [{ embedding: data.embedding.values }]
    });

  } catch (error) {
    console.error('Embedding error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// ─── START ───
app.listen(4000, () => console.log('Proxy running on port 4000'));