// Мир → СМИ: выпуски таблоидов, газет, глянца и ТВ по событиям истории.
// Текст пишет модель (что видно со стороны: папарацци, утечки, домыслы — от драмы до абсурда),
// вёрстка — своя на каждый вид, фото — через рисовалку с лицами. «Постер» — весь выпуск одной картинкой.
// Выпуск можно «пустить в историю»: модель узнает, что это сейчас пишут, и кто-то в сцене может наткнуться.

import { icon } from './icons.js';
import { chatStyle, styleText } from './shots.js';

let A = null;
export function initPress(api) { A = api; }

export const PRESS_KINDS = {
    tabloid: { label: 'Таблоид', ic: 'flame', what: 'жёлтая пресса: сплетни, папарацци, опрос' },
    paper: { label: 'Газета', ic: 'news', what: 'серьёзная газета: передовица, колонки, коротко' },
    glossy: { label: 'Глянец', ic: 'star', what: 'обложка журнала с громкими анонсами' },
    tv: { label: 'ТВ', ic: 'tv', what: 'срочный выпуск: бегущая строка, прямой эфир' },
    poster: { label: 'Постер', ic: 'image', what: 'весь выпуск одной картинкой (как коллаж)' },
};

const esc = (v) => A.esc(v);
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const list = () => { const cm = A.chatMeta(); if (!Array.isArray(cm.press)) cm.press = []; return cm.press; };
const busy = new Set(); // kind или id выпуска
let open = ''; // id выпуска, развёрнутого полностью

// ───────────── что знают СМИ ─────────────

function digest() {
    const st = A.worldState();
    const ev = A.horaeEvents().slice(-20).map(e => `- ${[e.timestamp?.story_date, e.event?.summary].filter(Boolean).join(': ')}`).join('\n');
    const store = A.chronStore();
    const chips = Object.entries(store).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 16).map(([, e]) => (e.chips || []).join('; ')).filter(Boolean).reverse().join('\n');
    const moments = Object.values(A.relationsState()).flatMap(p => (p.moments || []).slice(-2).map(x => `${A.shortName(p.a)} и ${A.shortName(p.b)}: ${x.text}`)).slice(-8).join('\n');
    const secrets = A.secretsState().slice(-6).map(x => `- ${x.text}`).join('\n');
    const prev = list().slice(-4).map(p => `- ${p.data?.outlet || ''}: ${p.data?.headline || ''}`).join('\n');
    return [
        `Дата в мире: ${[A.weekday(st.timestamp?.story_date), st.timestamp?.story_date, st.timestamp?.story_time].filter(Boolean).join(', ') || 'не записана'}. Где сейчас герои: ${st.scene?.location || '—'}.`,
        `Персонажи истории: ${A.castNames(st).join(', ')}.`,
        ev ? `Свежие события:\n${ev}` : '',
        chips ? `Что менялось в последних постах:\n${chips}` : '',
        moments ? `Моменты пар:\n${moments}` : '',
        secrets ? `ТАЙНЫ — прессе неизвестны; можно только нелепый слух рядом с правдой, без точных деталей:\n${secrets}` : '',
        prev ? `Прошлые выпуски (не повторяй заголовки):\n${prev}` : '',
    ].filter(Boolean).join('\n\n');
}

const PRESS_SYSTEM = (kind) => `Ты — редакция СМИ внутри мира ролевой истории на русском (AU по Marvel). Пишешь выпуск: ${PRESS_KINDS[kind].what}.
Пресса знает только то, что видно со стороны: где героев видели на людях, фото папарацци, утечки, официальные заявления, соцсети. Остальное домысливает, путает и раздувает. Тайны истории — никогда точно; максимум нелепый слух.
Подача — от драмы и романтики до полного абсурда (как в жёлтой прессе: «хвост застрахован на 8 000 000», «почему тогда свечи?»). Смешно, живо, с фактами из истории, но глазами чужих людей.
Издание придумай сам — название под этот мир, эпоху и город (в 1940-е — газеты и радио, без интернета: тогда tweet = null). Даты — по миру истории.
Ответь только JSON:
{"outlet":"название","slogan":"девиз мелким шрифтом","kicker":"2–3 слова КАПСОМ над главным («ПРОПАЛА ЗВЕЗДА:», «СРОЧНО», «ЭКСКЛЮЗИВ»)","headline":"главный заголовок до 60 знаков","deck":"подзаголовок, 1 предложение","lead":"главный текст: ${kind === 'paper' ? '5–7 предложений, газетный стиль' : kind === 'tv' ? '2–3 предложения — что говорит ведущий' : '2–3 предложения'}",
"bars":["4–5 заголовков-плашек от драмы к абсурду, «СРОЧНО: …», «ИНСАЙДЕР: …»"],
"photos":[{"who":["точные имена персонажей в кадре"],"prompt":"English, 30-55 words: what the camera caught — who BY NAME ONLY (never describe faces, hair, eye or skin colour), where, action, clothes as in the story, light","caption":"подпись под фото по-русски, со временем: «22:13 — выходит из студии»"}],
"tweet":{"author":"кто пишет","handle":"@ник","text":"пост до 200 знаков","reposts":"18,7K","quotes":"2,3K","likes":"97,6K","replies":[{"author":"","handle":"@","text":"коротко"}]},
"dossier":[{"name":"имя героя","facts":["4–5 фактов о нём «по версии редакции», один нелепый"]}],
"poll":{"q":"вопрос опроса","options":[{"t":"вариант","p":42}]},
"rumor":"слух дня, 1–2 предложения",
"news":["4–5 коротких новостей одной строкой"],
"quotes":[{"who":"кто (прохожая, эксперт, бариста)","text":"что сказал"}],
"ticker":["5–7 строк бегущей строки"],
"coverlines":["4–6 анонсов на обложку"],
"stamp":"штамп поверх («ЭКСКЛЮЗИВ ТОЛЬКО У НАС!», «TOP SECRET»)"}
Фото: ${kind === 'glossy' ? '1 — обложечная фотосессия героя или пары' : kind === 'poster' ? '0' : kind === 'tabloid' ? '3 — главный кадр и два снимка «из засады»' : '1–2'}. Опрос — 3–4 варианта, проценты в сумме 100. Без пошлости.`;

async function generate(kind) {
    const out = await A.askModel([{ role: 'system', content: PRESS_SYSTEM(kind) }, { role: 'user', content: digest() }], 2600);
    const j = A.extractJson(out);
    if (!j || !str(j.headline)) throw new Error('редакция ответила пусто');
    const st = A.worldState();
    const n = (v, max) => str(v).slice(0, max);
    const poll = j.poll && arr(j.poll.options).length ? { q: n(j.poll.q, 120), options: arr(j.poll.options).slice(0, 4).map(o => ({ t: n(o?.t, 60), p: Math.max(0, Math.min(100, Math.round(Number(o?.p) || 0))) })).filter(o => o.t) } : null;
    if (poll) { const sum = poll.options.reduce((a, o) => a + o.p, 0) || 1; poll.options.forEach(o => { o.p = Math.round(o.p * 100 / sum); }); }
    const tw = j.tweet && str(j.tweet.text) ? { author: n(j.tweet.author, 40), handle: n(j.tweet.handle, 30), text: n(j.tweet.text, 280), reposts: n(j.tweet.reposts, 10), quotes: n(j.tweet.quotes, 10), likes: n(j.tweet.likes, 10), replies: arr(j.tweet.replies).slice(0, 3).map(r => ({ author: n(r?.author, 30), handle: n(r?.handle, 30), text: n(r?.text, 120) })).filter(r => r.text) } : null;
    return {
        outlet: n(j.outlet, 50) || 'Сплетни 24/7', slogan: n(j.slogan, 80), kicker: n(j.kicker, 40), headline: n(j.headline, 90), deck: n(j.deck, 200), lead: n(j.lead, 1400),
        bars: arr(j.bars).map(x => n(x, 120)).filter(Boolean).slice(0, 5),
        photos: arr(j.photos).filter(p => str(p?.prompt).length > 15).slice(0, kind === 'tabloid' ? 3 : 2).map(p => ({ who: arr(p.who).map(A.canonName).filter(Boolean).slice(0, 3), prompt: n(p.prompt, 600), caption: n(p.caption, 90), img: '' })),
        tweet: tw,
        dossier: arr(j.dossier).slice(0, 2).map(d => ({ name: n(d?.name, 40), facts: arr(d?.facts).map(x => n(x, 80)).filter(Boolean).slice(0, 5) })).filter(d => d.name && d.facts.length),
        poll, rumor: n(j.rumor, 260),
        news: arr(j.news).map(x => n(x, 120)).filter(Boolean).slice(0, 5),
        quotes: arr(j.quotes).slice(0, 3).map(q => ({ who: n(q?.who, 40), text: n(q?.text, 160) })).filter(q => q.text),
        ticker: arr(j.ticker).map(x => n(x, 100)).filter(Boolean).slice(0, 7),
        coverlines: arr(j.coverlines).map(x => n(x, 70)).filter(Boolean).slice(0, 6),
        stamp: n(j.stamp, 40), date: st.timestamp?.story_date || '', time: st.timestamp?.story_time || '',
    };
}

// ───────────── фото ─────────────

const PHOTO_LOOK = {
    tabloid: 'candid paparazzi photograph taken from a distance with a telephoto lens, on-camera flash, slight grain and motion blur, real-life tabloid look',
    paper: 'press photograph for a newspaper front page, documentary realism, natural light',
    tv: 'news footage still from a TV camera, broadcast look, slightly soft, real location',
    glossy: 'glossy magazine cover photoshoot, editorial lighting, confident poses, clean background, high-end fashion photography',
};

async function faces(who) {
    const refs = [], names = [];
    for (const n of who.slice(0, 3)) { try { const r = await A.faceRef(n); if (r) { refs.push(r); names.push(n); } } catch { /* без лица */ } }
    return { refs, note: refs.length ? `Reference images, in order: ${names.map(n => `${n}'s face`).join(', ')} — keep them recognisable; the references are only for identity, not style.\n` : '' };
}

async function drawPhoto(item, k) {
    const ph = item.data.photos[k];
    const { refs, note } = await faces(ph.who);
    const old = /19[0-5]\d/.test(item.data.date || '') ? ' 1940s period photo, black-and-white or early colour film.' : '';
    ph.img = await A.drawPicture(`${ph.prompt}\n${note}Look: ${PHOTO_LOOK[item.kind] || PHOTO_LOOK.tabloid}.${old} No text, no captions, no watermark. No nudity.`, { aspect: item.kind === 'glossy' ? '3:4' : k ? '4:3' : '16:9', refs, prefix: 'life_press', max: 1400 });
}

async function drawPoster(item) {
    const d = item.data;
    const cast = [...new Set([...(d.dossier || []).map(x => A.canonName(x.name)), ...A.castNames(A.worldState())])].filter(Boolean).slice(0, 2);
    const { refs, note } = await faces(cast);
    const lines = [
        `Create a horizontal 16:9 poster in a fake breaking news / tabloid scandal style for the outlet «${d.outlet}».`,
        `LEFT: ${cast[0] || 'the main character'} as a famous person in the headline «${d.kicker || 'СРОЧНО'} ${d.headline}», soft cinematic light.`,
        cast[1] ? `RIGHT: ${cast[1]}, more dramatic light, confident, slightly mysterious aura.` : '',
        `CENTER: a bold BREAKING NEWS panel with these Russian headlines: ${(d.bars || []).slice(0, 4).map(b => `«${b}»`).join(', ')}.`,
        d.tweet ? `A fake social media post card in Russian by ${d.tweet.handle || d.tweet.author}: «${d.tweet.text}».` : '',
        `BOTTOM: a film strip with small chibi versions of the characters, a hot poll «${d.poll?.q || 'Что между ними?'}», a sticky note «${d.rumor || ''}».`,
        'DESIGN: rich tabloid collage, film strip elements, paparazzi flashes, torn paper edges, polaroids, stamps like «ЭКСКЛЮЗИВ», «TOP SECRET». Red, black and white drama palette. All text strictly in RUSSIAN and readable.',
        note.trim(),
        `Style: ${styleText(chatStyle())}. No nudity.`,
    ].filter(Boolean).join('\n');
    d.poster = await A.drawPicture(lines, { aspect: '16:9', refs, prefix: 'life_press', max: 2000 });
}

// ───────────── выпуск ─────────────

async function makeIssue(kind) {
    if (busy.has(kind)) return;
    const mine = [kind];
    busy.add(kind);
    A.render();
    try {
        const data = await generate(kind);
        const item = { id: A.uid(), kind, mes: A.lastAiIndex(), at: Date.now(), data };
        A.chatMeta().press = [...list(), item].slice(-30);
        open = item.id;
        A.saveMeta();
        busy.delete(kind);
        // главное фото — сразу, остальные по тапу
        const k = kind === 'poster' ? item.id : `${item.id}:0`;
        if (kind === 'poster' || data.photos.length) { mine.push(k); busy.add(k); }
        A.render();
        if (kind === 'poster') await drawPoster(item);
        else if (data.photos.length) await drawPhoto(item, 0);
        A.saveMeta();
    } catch (e) {
        A.toast('error', esc(String(e?.message || e)), '✦ СМИ');
    } finally {
        mine.forEach(x => busy.delete(x));
        A.render();
    }
}

// ───────────── вёрстка ─────────────

const photo = (item, k, cls = '') => {
    const p = item.data.photos[k];
    if (!p) return '';
    const wait = busy.has(`${item.id}:${k}`);
    return p.img
        ? `<button class="lf-pr-ph ${cls}" data-act="lightbox" data-src="${esc(p.img)}" data-mes="${item.mes}" style="background-image:url('${esc(p.img)}')"></button>`
        : `<button class="lf-pr-ph empty ${cls}${wait ? ' wait' : ''}" data-act="press-photo" data-id="${esc(item.id)}" data-k="${k}">${wait ? '<i class="lf-det-sh"></i>' : icon('camera')}<small>${wait ? 'снимаю…' : 'снять фото'}</small></button>`;
};
const pct = (o) => o.map((x, k) => `${['#d9687b', '#5bb5b0', '#e8a04a', '#8a5a9e'][k % 4]} ${o.slice(0, k).reduce((a, y) => a + y.p, 0)}% ${o.slice(0, k + 1).reduce((a, y) => a + y.p, 0)}%`).join(', ');
const POLL_C = ['#d9687b', '#5bb5b0', '#e8a04a', '#8a5a9e'];

function tweetHtml(t) {
    if (!t) return '';
    return `<div class="lf-pr-tw">
        <div class="lf-pr-tw-h"><span class="lf-pr-tw-av">${esc((t.author || '?').slice(0, 1))}</span><span><b>${esc(t.author)} <i class="lf-pr-ver">✓</i></b><small>${esc(t.handle)}</small></span></div>
        <p>${esc(t.text)}</p>
        <div class="lf-pr-tw-s"><span>Репосты: <b>${esc(t.reposts || '1,2K')}</b></span><span>Цитаты: <b>${esc(t.quotes || '340')}</b></span><span>Нравится: <b>${esc(t.likes || '9,8K')}</b></span></div>
        ${t.replies?.length ? `<div class="lf-pr-tw-r">${t.replies.map(r => `<div><b>${esc(r.author)}</b> <small>${esc(r.handle)}</small><span>${esc(r.text)}</span></div>`).join('')}</div>` : ''}
    </div>`;
}

function pollHtml(p) {
    if (!p) return '';
    return `<div class="lf-pr-poll"><div class="lf-pr-poll-h">Горячий опрос:</div><p>${esc(p.q)}</p>
        <div class="lf-pr-poll-b"><ol>${p.options.map((o, k) => `<li><i style="background:${POLL_C[k % 4]}"></i>${esc(o.t)}</li>`).join('')}</ol>
        <span class="lf-pr-pie" style="background:conic-gradient(${pct(p.options)})">${p.options.map((o, k) => `<b style="--a:${(p.options.slice(0, k).reduce((a, y) => a + y.p, 0) + o.p / 2) * 3.6}deg">${o.p}%</b>`).join('')}</span></div></div>`;
}

const barcode = () => '<span class="lf-pr-bar"></span>';

function tabloidHtml(item) {
    const d = item.data;
    const barCls = ['red', 'teal', 'paper', 'ink', 'ink2'];
    return `<article class="lf-press tabloid">
        <div class="lf-pr-top"><span>${esc(d.outlet)} • СРОЧНО • ГОРЯЧО • ЭКСКЛЮЗИВНО</span><b class="lf-pr-live">LIVE</b></div>
        <div class="lf-pr-hero">${photo(item, 0, 'torn')}${d.kicker ? `<span class="lf-pr-kick">${esc(d.kicker)}</span>` : ''}${d.stamp ? `<span class="lf-pr-stamp">${esc(d.stamp)}</span>` : ''}</div>
        <h2 class="lf-pr-bn">${esc(d.headline)}</h2>
        ${d.deck ? `<p class="lf-pr-deck">${esc(d.deck)}</p>` : ''}
        <div class="lf-pr-bars">${d.bars.map((b, k) => { const m = b.match(/^([^:]{2,16}):\s*(.+)$/); return `<div class="lf-pr-bars-i ${barCls[k % barCls.length]}">${m ? `<b>${esc(m[1])}:</b> ${esc(m[2])}` : esc(b)}</div>`; }).join('')}</div>
        ${d.photos.length > 1 ? `<div class="lf-pr-pol">${d.photos.slice(1).map((p, k) => `<figure class="lf-pr-polaroid r${k % 2}">${photo(item, k + 1)}<figcaption>${esc(p.caption)}</figcaption></figure>`).join('')}</div>` : ''}
        ${tweetHtml(d.tweet)}
        ${d.lead ? `<p class="lf-pr-lead">${esc(d.lead)}</p>` : ''}
        <div class="lf-pr-notes">
            ${d.dossier.map(x => `<div class="lf-pr-note"><i class="lf-pr-tape"></i><h4>Досье: ${esc(x.name)}</h4><ul>${x.facts.map(f => `<li>${esc(f)}</li>`).join('')}</ul></div>`).join('')}
            ${d.rumor ? `<div class="lf-pr-note y"><i class="lf-pr-tape"></i><h4>Слух дня:</h4><p>${esc(d.rumor)}</p></div>` : ''}
        </div>
        <div class="lf-pr-film"><i></i><span>Фанфики пишутся быстрее, чем сценарии</span><i></i></div>
        ${pollHtml(d.poll)}
        ${d.news.length ? `<div class="lf-pr-latest"><h4>Последние новости:</h4><ul>${d.news.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
        <div class="lf-pr-foot">${barcode()}<span><b>${esc(d.outlet)}</b>${esc(d.slogan || 'Читаем. Сплетничаем. Верим. (Или делаем вид)')}</span><span class="lf-pr-stamp2">TOP SECRET</span></div>
    </article>`;
}

function paperHtml(item) {
    const d = item.data;
    return `<article class="lf-press paper">
        <div class="lf-pr-mast"><small>${esc(d.slogan || 'Ежедневная газета')}</small><h1>${esc(d.outlet)}</h1><div class="lf-pr-dl"><span>${esc(A.weekday(d.date) || '')} ${esc(d.date)}</span><span>Выпуск № ${(item.at % 9000) + 1000}</span><span>Цена 2 $</span></div></div>
        ${d.kicker ? `<div class="lf-pr-kick2">${esc(d.kicker)}</div>` : ''}
        <h2>${esc(d.headline)}</h2>
        ${d.deck ? `<p class="lf-pr-deck">${esc(d.deck)}</p>` : ''}
        ${d.photos[0] ? `<figure class="lf-pr-fig">${photo(item, 0)}<figcaption>${esc(d.photos[0].caption)}</figcaption></figure>` : ''}
        <div class="lf-pr-cols"><p class="lf-pr-drop">${esc(d.lead)}</p>${d.quotes.map(q => `<blockquote>«${esc(q.text)}»<cite>— ${esc(q.who)}</cite></blockquote>`).join('')}</div>
        <div class="lf-pr-side">
            ${d.news.length ? `<div><h4>Коротко</h4><ul>${d.news.map(n => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}
            ${d.rumor ? `<div><h4>Говорят, что…</h4><p>${esc(d.rumor)}</p></div>` : ''}
            ${d.photos[1] ? `<div>${photo(item, 1)}<small>${esc(d.photos[1].caption)}</small></div>` : ''}
        </div>
        ${d.bars.length ? `<div class="lf-pr-also"><b>Также в номере:</b> ${d.bars.map(esc).join(' · ')}</div>` : ''}
    </article>`;
}

function glossyHtml(item) {
    const d = item.data;
    const cl = d.coverlines.length ? d.coverlines : d.bars;
    return `<article class="lf-press glossy">
        <div class="lf-pr-cover">${photo(item, 0, 'cover')}
            <h1 style="font-size:${Math.max(24, Math.min(64, Math.floor(330 / (Math.max(4, d.outlet.length) * 0.66))))}px">${esc(d.outlet)}</h1>
            <div class="lf-pr-cl l">${cl.slice(0, Math.ceil(cl.length / 2)).map((x, k) => `<p class="${k ? '' : 'big'}">${esc(x)}</p>`).join('')}</div>
            <div class="lf-pr-cl r">${cl.slice(Math.ceil(cl.length / 2)).map(x => `<p>${esc(x)}</p>`).join('')}</div>
            <div class="lf-pr-main"><span>${esc(d.kicker || 'Эксклюзив')}</span><b>${esc(d.headline)}</b></div>
            ${d.stamp ? `<span class="lf-pr-dot">${esc(d.stamp)}</span>` : ''}
            <div class="lf-pr-iss">${esc(d.date)} · ${barcode()}</div>
        </div>
        ${d.lead ? `<p class="lf-pr-lead">${esc(d.lead)}</p>` : ''}
        ${d.quotes.length ? `<div class="lf-pr-qs">${d.quotes.map(q => `<blockquote>«${esc(q.text)}»<cite>${esc(q.who)}</cite></blockquote>`).join('')}</div>` : ''}
    </article>`;
}

function tvHtml(item) {
    const d = item.data;
    const tick = (d.ticker.length ? d.ticker : d.news).map(esc).join('  ◆  ');
    return `<article class="lf-press tv">
        <div class="lf-pr-screen">${photo(item, 0, 'tvph')}
            <span class="lf-pr-bug">${esc(d.outlet)}</span>
            <span class="lf-pr-onair"><i></i>ПРЯМОЙ ЭФИР${d.time ? ` · ${esc(d.time)}` : ''}</span>
            <div class="lf-pr-l3"><b>${esc(d.kicker || 'СРОЧНО')}</b><span>${esc(d.headline)}</span></div>
            <div class="lf-pr-tick"><div><span>${tick}</span><span>${tick}</span></div></div>
        </div>
        ${d.lead ? `<p class="lf-pr-anchor"><b>Ведущий:</b> ${esc(d.lead)}</p>` : ''}
        ${d.quotes.length ? `<div class="lf-pr-vox">${d.quotes.map(q => `<div><b>${esc(q.who)}</b><span>«${esc(q.text)}»</span></div>`).join('')}</div>` : ''}
        ${d.bars.length ? `<ul class="lf-pr-rundown">${d.bars.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        ${tweetHtml(d.tweet)}
    </article>`;
}

function posterHtml(item) {
    const d = item.data;
    const wait = busy.has(item.id);
    return `<article class="lf-press poster">${d.poster
        ? `<button class="lf-pr-poster" data-act="lightbox" data-src="${esc(d.poster)}" data-mes="${item.mes}" style="background-image:url('${esc(d.poster)}')"></button>`
        : `<button class="lf-pr-poster empty${wait ? ' wait' : ''}" data-act="press-poster" data-id="${esc(item.id)}">${wait ? '<i class="lf-det-sh"></i>' : icon('image')}<small>${wait ? 'рисую постер…' : 'нарисовать постер'}</small></button>`}
        <div class="lf-pr-cap"><b>${esc(d.outlet)}:</b> ${esc(d.headline)}</div></article>`;
}

const RENDER = { tabloid: tabloidHtml, paper: paperHtml, glossy: glossyHtml, tv: tvHtml, poster: posterHtml };

function cardHtml(item) {
    const d = item.data;
    const pushed = A.chatMeta().pressPush?.id === item.id;
    const k = PRESS_KINDS[item.kind] || PRESS_KINDS.tabloid;
    if (open !== item.id) {
        const img = item.kind === 'poster' ? d.poster : d.photos?.find(p => p.img)?.img;
        return `<button class="lf-pr-tile ${esc(item.kind)}" data-act="press-open" data-id="${esc(item.id)}">
            <span class="lf-pr-tile-img"${img ? ` style="background-image:url('${esc(img)}')"` : ''}>${img ? '' : icon(k.ic)}</span>
            <span class="lf-pr-tile-t"><small>${icon(k.ic)} ${esc(k.label)} · ${esc(d.outlet)}${d.date ? ` · ${esc(d.date)}` : ''}</small><b>${esc(d.headline)}</b></span>
            ${pushed ? `<i class="lf-pr-pushed" title="Уже в истории">${icon('message')}</i>` : ''}
        </button>`;
    }
    return `<div class="lf-pr-open">
        ${(RENDER[item.kind] || tabloidHtml)(item)}
        <div class="lf-actions tight">
            <button class="lf-btn${pushed ? ' primary' : ''}" data-act="press-push" data-id="${esc(item.id)}">${icon('message')} ${pushed ? 'В истории' : 'Пустить в историю'}</button>
            ${item.kind !== 'poster' && d.photos.some(p => !p.img) ? `<button class="lf-btn" data-act="press-photos" data-id="${esc(item.id)}">${icon('camera')} Доснять фото</button>` : ''}
            ${item.kind === 'poster' && d.poster ? `<button class="lf-btn" data-act="press-poster" data-id="${esc(item.id)}">${icon('refresh')} Другой постер</button>` : ''}
            <button class="lf-btn ghost" data-act="press-close">${icon('chevU')} Свернуть</button>
            <button class="lf-iconbtn" data-act="press-del" data-id="${esc(item.id)}" title="Выбросить выпуск">${icon('trash')}</button>
        </div>
    </div>`;
}

/** Мир → СМИ. rumors — старые «Новости и слухи» (снизу, как были). */
export function renderPress(rumors = '') {
    const items = list().slice().reverse();
    const kinds = Object.entries(PRESS_KINDS).map(([k, x]) => `<button class="lf-pr-kind${busy.has(k) ? ' wait' : ''}" data-act="press-make" data-k="${k}" title="${esc(x.what)}">${busy.has(k) ? '<i class="lf-det-sh"></i>' : icon(x.ic)}<b>${esc(x.label)}</b><small>${busy.has(k) ? 'вёрстка…' : esc(x.what.split(':')[0])}</small></button>`).join('');
    return `${A.sec('Свежий выпуск', 'по событиям истории')}
    <div class="lf-pr-kinds">${kinds}</div>
    ${items.length ? `${A.sec('Киоск', String(items.length))}<div class="lf-pr-stand">${items.map(cardHtml).join('')}</div>` : '<div class="lf-hint">Что о героях пишут таблоиды, газеты, глянец и ТВ — глазами чужих людей: папарацци, утечки, домыслы, от драмы до абсурда. Модель выпусков не видит, пока ты не нажмёшь «Пустить в историю».</div>'}
    ${rumors ? `${A.sec('Сарафанное радио')}${rumors}` : ''}`;
}

/** Строка для модели: что сейчас пишут СМИ (если выпуск пущен в историю, пока не прошло 12 постов). */
export function pressPrompt() {
    const p = A.chatMeta().pressPush;
    if (!p) return '';
    if (A.lastAiIndex() - p.at > 12) { A.chatMeta().pressPush = null; A.saveMeta(); return ''; }
    return `[В СМИ сейчас: ${p.text}. Это видели многие — кто-то из персонажей может наткнуться на выпуск, получить ссылку, услышать по радио или отреагировать; не обязательно сразу.]`;
}

export async function pressClick(act, el) {
    const id = el.dataset.id;
    const item = list().find(x => x.id === id);
    switch (act) {
        case 'press-make': await makeIssue(el.dataset.k); return true;
        case 'press-open': open = open === id ? '' : id; A.render(); return true;
        case 'press-close': open = ''; A.render(); return true;
        case 'press-del':
            if (!item || !confirm('Выбросить выпуск?')) return true;
            A.chatMeta().press = list().filter(x => x.id !== id);
            if (A.chatMeta().pressPush?.id === id) A.chatMeta().pressPush = null;
            A.saveMeta(); A.render(); return true;
        case 'press-push': {
            if (!item) return true;
            const cm = A.chatMeta();
            if (cm.pressPush?.id === id) { cm.pressPush = null; A.toast('info', 'Модель больше не слышит про этот выпуск', '✦ СМИ', { timeOut: 1800 }); }
            else {
                const d = item.data;
                cm.pressPush = { id, at: A.lastAiIndex(), text: `${PRESS_KINDS[item.kind].label.toLowerCase()} «${d.outlet}» — «${d.headline}»${d.bars.length ? `; там же: ${d.bars.slice(0, 3).join('; ')}` : ''}${d.rumor ? `; слух дня: ${d.rumor}` : ''}` };
                A.toast('info', 'Модель узнает в следующем ответе, что это сейчас пишут', '✦ СМИ', { timeOut: 2400 });
            }
            A.saveMeta(); A.updatePrompt(); A.render(); return true;
        }
        case 'press-photo': {
            if (!item) return true;
            const k = Number(el.dataset.k) || 0;
            const key = `${id}:${k}`;
            if (busy.has(key)) return true;
            busy.add(key); A.render();
            try { await drawPhoto(item, k); A.saveMeta(); } catch (e) { A.toast('error', esc(String(e?.message || e)), '✦ СМИ'); } finally { busy.delete(key); A.render(); }
            return true;
        }
        case 'press-photos': {
            if (!item) return true;
            for (let k = 0; k < item.data.photos.length; k++) {
                if (item.data.photos[k].img) continue;
                const key = `${id}:${k}`;
                busy.add(key); A.render();
                try { await drawPhoto(item, k); A.saveMeta(); } catch (e) { A.toast('error', esc(String(e?.message || e)), '✦ СМИ'); busy.delete(key); break; }
                busy.delete(key);
            }
            A.render();
            return true;
        }
        case 'press-poster': {
            if (!item || busy.has(id)) return true;
            busy.add(id); A.render();
            try { await drawPoster(item); A.saveMeta(); } catch (e) { A.toast('error', esc(String(e?.message || e)), '✦ СМИ'); } finally { busy.delete(id); A.render(); }
            return true;
        }
    }
    return false;
}
