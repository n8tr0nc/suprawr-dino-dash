// pages/api/supra-price.js

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    // CoinGecko simple price endpoint for Supra (SUPRA)
    const cgRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=supra&vs_currencies=usd',
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!cgRes.ok) {
      console.error(
        'Coingecko SUPRA price error:',
        cgRes.status,
        cgRes.statusText
      );
      return res
        .status(502)
        .json({ ok: false, error: 'Failed to fetch SUPRA price' });
    }

    const data = await cgRes.json();
    const price = data?.supra?.usd;

    if (typeof price !== 'number' || !Number.isFinite(price)) {
      console.error('Unexpected Coingecko SUPRA payload:', data);
      return res
        .status(500)
        .json({ ok: false, error: 'Invalid price data for SUPRA' });
    }

    return res.status(200).json({
      ok: true,
      priceUsd: price,
    });
  } catch (err) {
    console.error('supra-price handler error:', err);
    return res
      .status(500)
      .json({ ok: false, error: 'Failed to fetch SUPRA price' });
  }
}
