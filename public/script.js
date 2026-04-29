let tickyCount = 0;
const SEARCH_DELAY = 300;
let lastTypingAt = 0;
let currentCurrency = 'usd';


function fmt(n) {

    let cur = currentCurrency.toLowerCase();
    let nfmt = 'en-US';
    if(cur == 'brl') nfmt = 'pt-BR';
    let min = 2;
    let max = 4;
    if (n > 100) {
        min = 0;
        max = 0;
    }
    if (n < 1) {
        min = 4;
        max = 4;
    }
    if(n < 0.1) {
        min = 8;
        max = 8;
    }

    return new Intl.NumberFormat(nfmt, { minimumFractionDigits: min, maximumFractionDigits: max }).format(n);
}


function fmtTime(ts) {
    if (!ts) return '--';

    const d = new Date(ts);

    return d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function typing() {
    lastTypingAt = Date.now();

    setTimeout(() => {
        if (Date.now() - lastTypingAt >= SEARCH_DELAY) {
            liveSearch();
        }
    }, SEARCH_DELAY);
}

async function liveSearch() {
    const q = document.getElementById('search').value.trim();
    const box = document.getElementById('suggest');
    if (q.length < 2) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }
    const r = await fetch('/search?q=' + encodeURIComponent(q)).catch(() => null);
    if (!r) return;
    const j = await r.json();

    if (!j.length) {
        box.innerHTML = '';
        box.style.display = 'none';
        return;
    }


    const input = document.getElementById('search');
    const rect = input.getBoundingClientRect();

    box.style.display = 'block';
    box.style.width = rect.width + 'px';

    box.innerHTML = j.map(x => `
<div class="sug" onclick="pick('${x.ticker}')">
    <img src="${x.icon}" class="sug-icon" />
    ${x.ticker.toUpperCase()} — ${x.name}
</div>
`).join('');


}

function pick(t) {
    addCard(t);
    document.getElementById('search').value = '';
    document.getElementById('suggest').innerHTML = '';
    document.getElementById('suggest').style.display = 'none';
}

async function addCard(t) {
    //t = document.getElementById('search').value.trim();
    if (!t) return;
    let ret = await fetch('/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ticker: t
        })
    });

    let newTicker = await ret.json();

    if (!newTicker.ticker) {
        toast('Not possible to add');
        return;
    }
    //location.reload();
    addCardDOM(newTicker);

}


function addCardDOM(c) {
    let t = c.ticker;
    const grid = document.getElementById('grid');
    const el = document.createElement('div');
    el.id = 'card-' + t;
    el.className = 'card';
    el.dataset.ticker = t;
    el.draggable = true;
    el.innerHTML = `
                <div class='row'>
                    <div class='ticker-wrap'><span class='drag'>⋮⋮</span>
                        <img src="${c.icon}" class="coinicon" />
                        <span class='ticker'>
                            ${c.ticker.toUpperCase()}
                        </span>
                    </div>
                    <button class='remove' onclick="removeCard('${c.ticker}')">✕</button>
                </div>
                <div class='price' id='p-${c.ticker}'>$ --</div>
                <div class='chg pending' id='c-${c.ticker}'>Waiting next cycle...</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class='upd' id='u-${c.ticker}'>Pending update</div>
                    <div class="links">
                        <a target="_blank" href="https://www.google.com/search?q=${c.id}/${currentCurrency}">Google</a>
                        <a target="_blank" href="https://www.coingecko.com/en/coins/${c.id}">Gecko</a>
                        <a target="_blank" href="https://coinmarketcap.com/currencies/${c.id}">CMC</a>
                    </div>

                </div>
                <div class='spark' id='s-${c.ticker}'></div>
            </div>`;

    el.style.opacity = '0';
    el.style.transform = 'scale(.96) translateY(8px)';

    grid.appendChild(el);

    requestAnimationFrame(() => {
        el.style.opacity = '1';
        el.style.transform = 'scale(1) translateY(0)';
    });

}


async function removeCard(t) {
    await fetch('/remove', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ticker: t
        })
    });

    //location.reload();

    const el = document.getElementById('card-' + t);
    el.style.opacity = '0';
    el.style.transform = 'scale(.96) translateY(-6px)';
    setTimeout(() => el.remove(), 180);

}



async function ticky() {
    tickyCount = 0;

    const r = await fetch('/prices').catch(() => null);

    if (!r) {
        toast('Connection error');
        return;
    }

    if (r.status === 429) {
        toast('CoinGecko rate limit reached. Waiting for auto-refresh.');
        return;
    }

    const j = await r.json();
    for (const k in j) {
        const d = j[k],
            p = document.getElementById('p-' + k),
            c = document.getElementById('c-' + k),
            u = document.getElementById('u-' + k),
            s = document.getElementById('s-' + k);
        if (!p) continue;

        p.innerHTML = `${fmt(d.usd)}<span class="ccy">${currentCurrency.toUpperCase()}</span>`;

        const vals = (d.sparkline || []).slice(-24);

        if (!vals.length) continue;

        const first = vals[0];
        const last = vals[vals.length - 1];

        const delta_perc = ((last - first) / first) * 100;

        let delta_label = delta_perc.toFixed(2) + '%';
        if (delta_perc > 0) delta_label = '+' + delta_label;
        c.textContent = delta_label;
        c.className = 'chg ' + (delta_perc >= 0 ? 'up' : 'down');
        if (u) u.innerHTML = `<svg class="clock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">  <circle cx="12" cy="12" r="8"></circle>  <path d="M12 8v4l3 2"></path></svg>${fmtTime(d.updated_at)}`;

        s.innerHTML = '';

        if (!vals.length) continue;

        drawLineChart(s, vals);
    }
}


function drawLineChart(el, vals) {

    const w = 100;
    const h = 40;
    const pad = 2;

    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const diff = max - min || 1;

    const up = vals[vals.length - 1] >= vals[0];

    const points = vals.map((v, i) => {

        const x = (i / (vals.length - 1)) * w;

        const y =
            h - pad -
            ((v - min) / diff) * (h - pad * 2);

        return `${x},${y}`;
    }).join(' ');

    el.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}"
             preserveAspectRatio="none"
             class="sparksvg">

            <polyline
                fill="none"
                stroke="${up ? '#53d769' : '#ff5d5d'}"
                stroke-width="0.7"
                points="${points}"
                stroke-linecap="round"
                stroke-linejoin="round"
            />
        </svg>
    `;
}


function updateCountdown() {
    tickyCount++;

    if(tickyCount >= 60) {
        tickyCount = 0;
        ticky();
        return;
    }

    document
        .querySelectorAll('.chg.pending')
        .forEach(el => {
            el.textContent =
                'Next update in ' + (60-tickyCount) + 's';
        });    
}


async function changeCurrency() {
    const v = document.getElementById('currency').value;
    currentCurrency = v;

    let ret = await fetch('/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: v })
    });

    await ticky();
}


async function mountCards() {
    //const cards = document.querySelectorAll('.card');
    const cards = await fetch('/tickers').then(r => r.json()).catch(() => []);

    cards.forEach(card => {
        const t = card.ticker;
        addCardDOM({
            ticker: card.ticker,
            id: card.id,
            name: card.name,
            icon: card.icon
        });
    });
}


function donateModal() {

    const addr = "thanksalot@walletofsatoshi.com"

    Swal.fire({
        title: "Send a Lightning tip ⚡",
        html: `
      <div style="margin-top:10px;font-size:16px;color:#888">
        If this tool is useful to you, consider a tip to support development and maintenance. Thank you! 🙏
        <br><br>
        Lightning Address ⚡
      </div>

        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=lightning:${addr}"
           style="margin:10px auto;display:block">


      <div style="margin-top:4px;font-size:14px;font-family:monospace">
        ${addr}
      </div>
    `,
        confirmButtonText: "Copy Lightning address",
        confirmButtonColor: '#0fa90f',
    }).then((result) => {
        if (result.isConfirmed) {
            copyText(addr)
        }
    })
}


function copyText(text) {

    if (navigator.clipboard && navigator.clipboard.writeText) {

        navigator.clipboard.writeText(text)

    } else {

        const t = document.createElement("textarea")
        t.value = text
        document.body.appendChild(t)
        t.select()
        document.execCommand("copy")
        document.body.removeChild(t)

    }

    Swal.fire({
        toast: true,
        position: "top",
        icon: "success",
        title: "Lightning address copied",
        showConfirmButton: false,
        timer: 1500
    })

}




function toast(msg) {
    Toastify({
        text: '⚠ ' + msg,
        duration: 3300,
        gravity: "top",
        position: "center",
        close: false,
        stopOnFocus: true,
        style: {
            background: '#333434',
            color: '#fff',
            border: '2px solid #fff',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            padding: '24px'
        }
    }).showToast();
}



async function init() {

    await mountCards();
    await ticky();
    await new Promise(r => setTimeout(r, 500));
    //setInterval(ticky, 60000); // update every minute
    setInterval(updateCountdown, 1000);


    const g = document.getElementById('grid');

    new Sortable(g, {
        animation: 180,
        handle: '.drag',
        ghostClass: 'drag-ghost',
        chosenClass: 'drag-chosen',
        dragClass: 'dragging',

        onEnd: async () => {
            const order = [...g.querySelectorAll('.card')]
                .map(x => x.dataset.ticker);

            await fetch('/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order })
            });
        }
    });

}


//onload  function of documnet
document.addEventListener('DOMContentLoaded', () => {
    let suggest = document.getElementById('suggest');
    suggest.style.display = 'none'; // Oculta el input al cargar la página

    const currency = document.getElementById('currency');
    currentCurrency = currency.dataset.current || 'usd';
    currency.value = currentCurrency;

    document.getElementById("donateBtn").addEventListener("click", donateModal);

    // block right click
    document.addEventListener('contextmenu', event => event.preventDefault());

    init();
});

