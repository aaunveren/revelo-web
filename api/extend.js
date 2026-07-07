import { kv } from '@vercel/kv';

const TIER_MS = {
  '1mo': 30  * 24 * 3600 * 1000,
  '3mo': 90  * 24 * 3600 * 1000,
  '12mo':365 * 24 * 3600 * 1000,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Simple secret-in-URL verification (set CODAPAY_WEBHOOK_SECRET in Vercel env)
  const secret = req.query.secret;
  if (secret !== process.env.CODAPAY_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = req.body;

    // Codapay sends the share ID in a custom field during checkout.
    // The field name may differ — adapt to Codapay's actual payload below.
    const shareId =
      payload.custom_field    ||   // common webhook field
      payload.customData       ||
      payload.metadata?.shareId ||
      payload.shareId;

    const tier =
      payload.metadata?.tier ||
      payload.tier            ||
      '1mo';

    if (!shareId) {
      return res.status(400).json({ error: 'Missing shareId in payload' });
    }

    const share = await kv.get(`share:${shareId}`);
    if (!share) {
      return res.status(404).json({ error: 'Share not found or expired' });
    }

    const now = Date.now();
    // Extend from current expiry or now (whichever is later)
    const base         = Math.max(share.expiresAt, now);
    const durationMs   = TIER_MS[tier] ?? TIER_MS['1mo'];
    const newExpiresAt = base + durationMs;

    const updated  = { ...share, tier, expiresAt: newExpiresAt };
    const ttlSec   = Math.ceil((newExpiresAt - now) / 1000) + 3600;
    await kv.set(`share:${shareId}`, updated, { ex: ttlSec });

    console.log(`[extend] ${shareId} extended to ${new Date(newExpiresAt).toISOString()}`);
    res.json({ success: true, shareId, expiresAt: newExpiresAt });
  } catch (err) {
    console.error('[api/extend]', err);
    res.status(500).json({ error: err.message });
  }
}
