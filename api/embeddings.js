module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    if (data?.error?.status === 'RESOURCE_EXHAUSTED') {
      return res.status(429).json({ error: 'Gemini daily quota exceeded.' });
    }

    if (data?.error) {
      return res.status(500).json({ error: data.error.message });
    }

    if (!data?.embedding?.values) {
      return res.status(500).json({ error: 'No embedding returned from Gemini' });
    }

    res.status(200).json({
      data: [{ embedding: data.embedding.values }]
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}