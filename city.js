// Город сегодня. Раз в день истории (или по кнопке) Летописец собирает фон места и эпохи: афиша (кино, театр,
// концерты, выставки), городские службы (пробки, транспорт, ЧП, ремонт), цены и курсы, и что пишут в сети
// обычные люди под своими никами — они знают только публичное и слитое и могут ошибаться. Модель получает
// пару строк фона: есть куда позвать на свидание, почему опоздали и о чём говорят в очереди. В 1940-е — без
// сети: вместо неё разговоры в очереди и на кухнях. Мир → Город. Идея — «Мир: афиша, службы, цены,
// комментарии сети» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { storyDay, str, arr } from './hudkit.js';

let A = null;
export function initCity(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.city || typeof s.city !== 'object') s.city = {};
    if (s.city.on === undefined) s.city.on = true;
    if (s.city.auto === undefined) s.city.auto = true;
    if (s.city.feed === undefined) s.city.feed = true;
    return s.city;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.city || typeof cm.city !== 'object') cm.city = {};
    return cm.city;
}
const year = () => { const d = A.parseDate(storyDay(A)); return d && !isNaN(d) ? d.getFullYear() : null; };
const old = () => { const y = year(); return y !== null && y < 1995; };

let running = false;

export async function cityRun() {
    if (running || !A.hasChat()) return false;
    running = true;
    try {
        const st = A.worldState();
        const day = storyDay(A);
        const place = A.locTop(st?.scene?.location || '') || '';
        let days = '';
        try { days = A.daysBrief?.() || ''; } catch { /* */ }
        const net = old() ? '"talk":[{"who":"кто говорит: очередь за хлебом, соседка, таксист, солдат в увольнении","t":"что говорят люди, 1-2 предложения"}]' : '"talk":[{"who":"ник в сети (форум, чат района, даркнет-борд)","t":"комментарий, 1-2 предложения, живым языком"}]';
        const sys = `Ты пишешь фон дня для ролевой истории: что происходит в городе, где идёт действие, СЕГОДНЯ по дате истории — правдоподобно для места и эпохи${year() ? ` (${year()} год)` : ''}. Ответ — строго один JSON по-русски:
{"events":[{"kind":"кино|театр|концерт|выставка|спорт|клуб|улица|лекция","t":"название","w":"где и когда"}],"city":[{"kind":"пробки|транспорт|погода|ремонт|ЧП|полиция|коммуналка","t":"что происходит, 4-12 слов"}],"prices":[{"t":"что","v":"сколько","d":"как изменилось или пусто"}],${net},"horo":"гороскоп дня, как в газете или в приложении эпохи: 2 предложения, расплывчато и с намёком на то, что происходит в истории"}
events — 3-5, реальные для эпохи или правдоподобные (в 1940-е — что идёт в кинотеатрах и на танцах, а не стриминг). city — 2-4. prices — 3-5: повседневное (кофе, такси, хлеб, бензин, билет) и курс, в деньгах места и времени. talk — 3-5 реплик обычных людей о публичных событиях истории и города: знают только то, что могло стать известно, домысливают, путают, ругаются между собой; тайны героев — только как нелепые слухи. К читателю не обращаются.`;
        const usr = `Дата истории: ${day || '—'}, ${A.weekday(day) || ''}. Место: ${place || 'город'}.${st?.scene?.atmosphere ? ` Погода: ${st.scene.atmosphere}.` : ''}${days ? `\nЧто было в истории в последние дни (для слухов и разговоров):\n${A.cut(days, 2500)}` : ''}`;
        const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1500, { check: (x) => Array.isArray(x?.events) || Array.isArray(x?.city), what: 'Город сегодня' });
        const c = M();
        c.day = day; c.place = place;
        c.events = arr(j.events).slice(0, 5).map(x => ({ kind: str(x?.kind, 20), t: str(x?.t, 90), w: str(x?.w, 90) })).filter(x => x.t);
        c.city = arr(j.city).slice(0, 4).map(x => ({ kind: str(x?.kind, 20), t: str(x?.t, 120) })).filter(x => x.t);
        c.prices = arr(j.prices).slice(0, 5).map(x => ({ t: str(x?.t, 40), v: str(x?.v, 30), d: str(x?.d, 30) })).filter(x => x.t);
        c.talk = arr(j.talk).slice(0, 5).map(x => ({ who: str(x?.who, 40), t: str(x?.t, 260) })).filter(x => x.t);
        c.horo = str(j.horo, 320);
        c.at = Date.now();
        A.saveMeta(); A.updatePrompt();
        return true;
    } finally { running = false; }
}

export function cityAfterPost() {
    if (!on() || !cfg().auto) return;
    const c = M();
    const day = storyDay(A);
    if (!day || day === c.day || day === c.seen) return;
    const first = !c.day && !c.seen;
    c.seen = day; A.saveMeta();
    if (!first) setTimeout(() => { cityRun().then(ok => { if (ok) A.render?.(); }).catch(e => console.warn('[Life] город', e)); }, 9000);
}

export function cityPrompt(type) {
    if (!A?.hasChat?.() || !on() || !cfg().feed || type === 'quiet' || type === 'impersonate') return '';
    const c = M();
    if (!c.day || c.day !== storyDay(A)) return '';
    const ev = (c.events || []).slice(0, 3).map(x => `${x.t}${x.w ? ` (${x.w})` : ''}`);
    const ct = (c.city || []).slice(0, 2).map(x => x.t);
    if (!ev.length && !ct.length) return '';
    return `[Город сегодня — фон, не сюжет: ${[ev.length ? `афиша — ${ev.join('; ')}` : '', ct.length ? `в городе — ${ct.join('; ')}` : ''].filter(Boolean).join('. ')}. Это есть в мире: на это можно позвать, из-за этого опоздать, об этом обмолвиться — к месту, не в каждом ответе.]`;
}

/** Мир → Город. */
export function cityHtml() {
    if (!on()) return '';
    const c = M();
    const fresh = c.day && c.day === storyDay(A);
    const tools = `<div class="lf-actions tight"><button class="lf-btn" data-act="cty-run">${A.icon('refresh')} ${c.day ? 'Обновить на сегодня' : 'Что сегодня в городе'}</button><button class="lf-chip${cfg().auto ? ' on' : ''}" data-act="cty-auto">сам, с новым днём</button><button class="lf-chip${cfg().feed ? ' on' : ''}" data-act="cty-feed">фон — модели</button></div>`;
    if (!c.day) return `${A.sec('Город сегодня')}<div class="lf-hint">Афиша, службы, цены и что говорят люди — по дате и месту истории. Модель получает пару строк фона: есть куда позвать и из-за чего опоздать.</div>${tools}`;
    const list = (title, rows, f) => rows?.length ? `${A.sec(title)}<div class="lf-cty">${rows.map(f).join('')}</div>` : '';
    return `${A.sec('Город сегодня', `${esc(c.place || '')}${c.place ? ' · ' : ''}${esc(c.day)}${fresh ? '' : ' — вчерашнее'}`)}
    ${list('Афиша', c.events, x => `<div class="lf-cty-r"><i>${esc(x.kind)}</i><span><b>${esc(x.t)}</b>${x.w ? `<small>${esc(x.w)}</small>` : ''}</span></div>`)}
    ${list('В городе', c.city, x => `<div class="lf-cty-r"><i>${esc(x.kind)}</i><span>${esc(x.t)}</span></div>`)}
    ${list('Цены', c.prices, x => `<div class="lf-cty-r pr"><span>${esc(x.t)}</span><b>${esc(x.v)}</b>${x.d ? `<small>${esc(x.d)}</small>` : ''}</div>`)}
    ${list(old() ? 'Что говорят люди' : 'Сеть', c.talk, x => `<div class="lf-cty-t"><b>${esc(x.who)}</b><p>${esc(x.t)}</p></div>`)}
    ${c.horo ? `${A.sec('Гороскоп дня')}<div class="lf-cty-t"><b>✨ звёзды</b><p>${esc(c.horo)}</p></div>` : ''}
    ${tools}`;
}

export async function cityClick(act, el) {
    if (!act.startsWith('cty-')) return false;
    if (act === 'cty-run') await A.withBusy(el, () => cityRun(), 'Собираю…');
    if (act === 'cty-auto') { cfg().auto = !cfg().auto; A.saveSettings(); }
    if (act === 'cty-feed') { cfg().feed = !cfg().feed; A.saveSettings(); }
    A.updatePrompt(); A.render();
    return true;
}
