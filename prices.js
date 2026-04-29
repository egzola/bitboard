

const cache = { ts: 0, data: null };

async function searchCoin(query) {
    const r = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(query), {
        headers: {
            'User-Agent': 'bitBoard/1.0',
            'Accept': 'application/json'
        }
    });
    const j = await r.json();
    if (!j.coins || !j.coins.length) return null;
    const exact = j.coins.find(x => x.symbol.toLowerCase() === query.toLowerCase()) || j.coins[0];
    return { ticker: exact.symbol.toLowerCase(), id: exact.id, name: exact.name, icon: exact.large };
}


async function getPrices(cards, currency = 'usd') {
    const now = Date.now();

    if (cache.data && now - cache.ts < 15000)
        return cache.data;

    const ids = cards.map(c => c.id).filter(Boolean).join(',');

    const ctrl = AbortSignal.timeout
        ? AbortSignal.timeout(5000)
        : undefined;

    const url =
        'https://api.coingecko.com/api/v3/coins/markets' +
        '?vs_currency=' + currency +
        '&sparkline=true' +
        '&price_change_percentage=24h' +
        '&ids=' + ids;

    const r = await fetch(url, {
        signal: ctrl,

        headers: {
            'User-Agent': 'bitBoard/1.0',
            'Accept': 'application/json'
        }
    });
    const j = await r.json();

    if (r.status === 429) {
        throw new Error('RATE_LIMIT');
    }

    const ts = new Date().toISOString();
    const out = {};

    if (!Array.isArray(j)) return cache.data || {};

    cards.forEach(c => {
        const d = j.find(x => x.id === c.id);
        if (!d) return;

        out[c.ticker] = {
            usd: d.current_price,
            usd_24h_change: d.price_change_percentage_24h,
            sparkline: d.sparkline_in_7d?.price || [],
            updated_at: ts
        };
    });

    cache.ts = now;
    cache.data = out;

    return out;
}


/*
async function getPricesBinance(cards, currency = 'usd') {

    const now = Date.now();

    if (cache.data && now - cache.ts < 15000)
        return cache.data;

    const quoteMap = {
        usd: 'USDT',
        brl: 'BRL',
        eur: 'EUR',
        btc: 'BTC',
        eth: 'ETH'
    };

    const quote = currency.toUpperCase() || 'USDT';

    const ctrl = AbortSignal.timeout
        ? AbortSignal.timeout(5000)
        : undefined;

    const ts = new Date().toISOString();
    const out = {};

    for (const c of cards) {

        const symbol = c.ticker.toUpperCase() + quote;

        try {

            const url =
              'https://api.binance.com/api/v3/ticker/24hr?symbol=' + symbol;

            const r = await fetch(url, { signal: ctrl });

            if (!r.ok) continue;

            const d = await r.json();

            out[c.ticker] = {
                usd: parseFloat(d.lastPrice),
                usd_24h_change: parseFloat(d.priceChangePercent),
                sparkline: [],
                updated_at: ts
            };

        } catch (e) {}
    }

    cache.ts = now;
    cache.data = out;

    return out;
}
*/

function clearCache() {
    cache.ts = 0;
    cache.data = null;
}

module.exports = { getPrices, searchCoin, clearCache };