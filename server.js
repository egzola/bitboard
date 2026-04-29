const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3711;
const DATA = path.join(__dirname, 'data', 'cards.json');
const apiRoutes = require('./api');
const { searchCoin, clearCache } = require('./prices');

const SETTINGS = path.join(__dirname, 'data', 'settings.json');


function readSettings() {
    // check if folder exists
    if (!fs.existsSync(path.dirname(SETTINGS))) {
        fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
    }


    //check if settings file exists
    if (!fs.existsSync(SETTINGS)) {
        const defaultSettings = {
            currency: "usd",
            currencies: ["aed", "ars", "aud", "bdt", "bhd", "brl", "btc", "cad", "chf", "clp", "cny", "czk", "dkk", "dot", "eth", "eur", "gbp", "hkd", "huf", "idr", "ils", "inr", "jpy", "krw", "kwd", "link", "lkr", "ltc", "mmk", "mxn", "myr", "ngn", "nok", "nzd", "php", "pkr", "pln", "rub", "sar", "sek", "sgd", "sol", "thb", "try", "twd", "uah", "usd", "vef", "vnd", "xrp", "zar"]
        };
        fs.writeFileSync(SETTINGS, JSON.stringify(defaultSettings, null, 2));
        return defaultSettings;
    }

    return JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
}

function saveSettings(v) {
    fs.writeFileSync(SETTINGS, JSON.stringify(v, null, 2));
}


function readCards() {
    //check if data folder exists
    if (!fs.existsSync(path.dirname(DATA))) {
        fs.mkdirSync(path.dirname(DATA), { recursive: true });
    }
    //check if data file exists
    if (!fs.existsSync(DATA)) {
        const defaultData = [
            {
                "ticker": "btc",
                "id": "bitcoin",
                "name": "Bitcoin",
                "icon": "https://coin-images.coingecko.com/coins/images/1/large/bitcoin.png",
                "ord": 1
            },
            {
                "ticker": "eth",
                "id": "ethereum",
                "name": "Ethereum",
                "icon": "https://coin-images.coingecko.com/coins/images/279/large/ethereum.png",
                "ord": 2
            }];
        fs.writeFileSync(DATA, JSON.stringify(defaultData, null, 2));
    }

    return JSON.parse(fs.readFileSync(DATA, 'utf8')).sort((a, b) => a.ord - b.ord);
}

function saveCards(v) {
    fs.writeFileSync(DATA, JSON.stringify(v, null, 2));
}

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.locals.readCards = readCards;
app.locals.saveCards = saveCards;
app.locals.readSettings = readSettings;
app.locals.saveSettings = saveSettings;


app.get('/', (req, res) => res.render('index', {

    cards: readCards(),
    settings: readSettings(),
}));

app.post('/add', async (req, res) => {
    const t = (req.body.ticker || '').toLowerCase().trim();
    let c = readCards();
    if (!t || c.find(x => x.ticker === t)) return res.json({
        ok: true
    });

    const found = await searchCoin(t).catch(() => null);
    if (!found) return res.json({
        ok: false
    });

    let newTicker = {
        ticker: found.ticker,
        id: found.id,
        name: found.name,
        icon: found.icon,
        ord: c.length + 1
    };

    c.push(newTicker);
    saveCards(c);

    res.json(newTicker);
});

app.post('/remove', (req, res) => {
    const t = (req.body.ticker || '').toLowerCase();
    let c = readCards().filter(x => x.ticker !== t).map((x, i) => ({
        ...x,
        ord: i + 1
    }));
    saveCards(c);
    res.json({
        ok: true
    });
});

app.get('/tickers', async (req, res) => {
    let tickers = await readCards();
    res.json(tickers);
});

app.post('/reorder', (req, res) => {
    const order = req.body.order || [];
    const current = readCards();

    const map = Object.fromEntries(
        current.map(x => [x.ticker, x])
    );

    saveCards(order.map((t, i) => ({
        ...map[t],
        ord: i + 1
    })));

    res.json({ ok: true });
});


app.post('/currency', (req, res) => {
    const s = readSettings();
    s.currency = (req.body.currency || 'usd').toLowerCase();
    app.locals.saveSettings(s);
    clearCache();
    res.json({ ok: true });
});


app.use('/', apiRoutes);
app.listen(PORT, () => console.log('BitBoard on ' + PORT));