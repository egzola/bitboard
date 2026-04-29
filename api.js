const router = require('express').Router();
const { getPrices, searchCoin } = require('./prices');

router.get('/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json([]);
        const r = await fetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q));
        const j = await r.json();
        res.json((j.coins || []).slice(0, 8).map(x => ({
            ticker: x.symbol,
            name: x.name,
            id: x.id,
            icon: x.large
        })));
    } catch (e) {
        res.json([]);
    }
});

router.get('/prices', async (req, res) => {
    try {
        const currency = req.app.locals.readSettings().currency;
        const cards = req.app.locals.readCards();
        const data = await getPrices(cards, currency);

        res.json(data);
    } catch (e) {
        res.status(429).json({
            ok: false,
            error: 'rate_limit'
        });
    }
});

module.exports = router;