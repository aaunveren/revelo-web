import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

// Allow larger payloads (compressed images as base64)
export const config = {
  api: { bodyParser: { sizeLimit: '20mb' } },
};

const TIER_MS = {
  free:  24 * 3600 * 1000,
  '1mo': 30  * 24 * 3600 * 1000,
  '3mo': 90  * 24 * 3600 * 1000,
  '12mo':365 * 24 * 3600 * 1000,
};

function genId() {
  return Array.from({ length: 12 }, () => Math.random().toString(36)[2]).join('');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const {
      images = {},
      sliderConfig = {},
      mode = 1,
      theme = 'dark',
      tier = 'free',
    } = req.body;

    const id = genId();
    const now = Date.now();
    const durationMs = TIER_MS[tier] ?? TIER_MS.free;
    const expiresAt = now + durationMs;

    // Upload each base64 image to Vercel Blob
    const blobUrls = {};
    for (const [key, dataUrl] of Object.entries(images)) {
      if (!dataUrl || !dataUrl.startsWith('data:')) continue;
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) continue;
      const header  = dataUrl.slice(0, commaIdx);
      const b64data = dataUrl.slice(commaIdx + 1);
      const mimeMatch = header.match(/data:([^;,]+)/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const ext  = mime.includes('png') ? 'png' : 'jpg';
      const buffer = Buffer.from(b64data, 'base64');
      const blob = await put(`shares/${id}/${key}.${ext}`, buffer, {
        access: 'public',
        addRandomSuffix: false,
        contentType: mime,
      });
      blobUrls[key] = blob.url;
    }

    const shareData = {
      id, mode, theme, tier,
      sliderConfig,
      blobUrls,
      expiresAt,
      createdAt: now,
    };

    // Store in KV with TTL + 1h buffer
    const ttlSec = Math.ceil(durationMs / 1000) + 3600;
    await kv.set(`share:${id}`, shareData, { ex: ttlSec });

    res.json({
      id,
      url: `https://reveloslider.vercel.app/p/${id}`,
      expiresAt,
    });
  } catch (err) {
    console.error('[api/share]', err);
    res.status(500).json({ error: err.message });
  }
}
