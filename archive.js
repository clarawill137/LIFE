// Архив. Сводка по всей истории чата без единого запроса к модели: сколько постов и дней, кто сколько пишет,
// длина ответов, доля реплик, календарь настроения (по лицам, которые Летописец ставит постам), атлас мест
// и кто с кем чаще в одной сцене. Мир → Архив. Идея — «Архив HUD: статистика, настроение, атлас мест»
// TavernOS HUD (alewwi), см. NOTICE-HUD.md.
// 0.72 — вкладки: Обзор (+ ритм сцен, кто кого упоминает) · Отношения (за что сдвигалось доверие и шрамы, у кого
// доверие ползёт вниз, давно не пересекались) · Места (кто бывает, кто живёт, кто работает) · Поиск · Отрезок
// (та же сводка по постам с № по №) · Другой чат (летопись старой ветки — только чтение) · выгрузка в JSON.

let A = null;
export function initArchive(api) { A = api; }
const esc = (v) => A.esc(v);

const EMO = { calm: ['спокоен', '#8fa3a8'], tender: ['нежно', '#e8a0b4'], laugh: ['смеётся', '#f0c96a'], flirt: ['дерзко', '#e07a5f'], angry: ['зол', '#c8324a'], sad: ['грусть', '#6f86c9'], tense: ['на взводе', '#d9a441'], tired: ['устал', '#7d7388'] };

let cache = { sig: '', data: null };
const ui = { tab: 'sum', q: '', from: '', to: '', other: null, chats: null, busy: '' };

const HOUR = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? Number(m[1]) : null; };
/** range — { from, to } по номерам постов: тогда сводка по отрезку, без кэша. */
function build(range = null) {
    const chat = A.chatArr();
    const sig = `${chat.length}:${A.hash(chat[chat.length - 1]?.mes || '')}`;
    if (!range && cache.sig === sig && cache.data) return cache.data;
    const lo = range ? Math.max(0, range.from) : 0;
    const hi = range ? Math.min(chat.length - 1, range.to) : chat.length - 1;
    const by = new Map();          // автор → { n, chars }
    const days = [];               // дни истории по порядку
    const dayIdx = new Map();
    const moods = new Map();       // имя → Map(день → { эмоция: n })
    const pairs = new Map();       // «a|b» → постов вместе
    const lens = [];
    const seen = new Map();        // «a|b» → { i, day } — когда были в одной сцене последний раз
    const atPlace = new Map();     // место → { who: Map(имя → { n, nights:Set, days:Set }) }
    const ment = new Map();        // «кто>кого» → раз
    const cast = names();
    let ai = 0, aiChars = 0, quoted = 0, posts = 0, words = 0;
    let day = '', loc = '', time = '';
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        const meta = m?.horae_meta;
        if (meta && !meta._skipHorae) { if (meta.scene?.location) loc = meta.scene.location; if (meta.timestamp?.story_time) time = meta.timestamp.story_time; }
        if (i < lo || i > hi) { const d0 = String(meta?.timestamp?.story_date || '').trim(); if (d0) day = d0; continue; }
        if (!A.isPost(m)) continue;
        posts++;
        const d = String(m.horae_meta?.timestamp?.story_date || '').trim();
        if (d) day = d;
        if (day && !dayIdx.has(day)) { dayIdx.set(day, days.length); days.push({ day, posts: 0 }); }
        if (day) days[dayIdx.get(day)].posts++;
        const text = A.plainText(m.mes);
        const who = A.canonName(m.name || '') || m.name || '—';
        const b = by.get(who) || { n: 0, chars: 0, user: !!m.is_user };
        b.n++; b.chars += text.length;
        by.set(who, b);
        words += (text.match(/\S+/g) || []).length;
        if (!m.is_user) {
            ai++; aiChars += text.length; lens.push(text.length);
            quoted += (text.match(/«[^»]{2,}»|"[^"]{2,}"|—\s[^\n—]{2,}/g) || []).join('').length;
            const em = A.chronOf(i)?.emo || {};
            for (const [n, k] of Object.entries(em)) {
                if (!EMO[k] || !day) continue;
                const name = A.canonName(n);
                if (!moods.has(name)) moods.set(name, new Map());
                const dm = moods.get(name);
                const o = dm.get(day) || {};
                o[k] = (o[k] || 0) + 1;
                dm.set(day, o);
            }
        }
        const here = [...new Set((m.horae_meta?.scene?.characters_present || []).map(A.canonName).filter(Boolean))].slice(0, 6);
        for (let a = 0; a < here.length; a++) for (let c = a + 1; c < here.length; c++) { const k = [here[a], here[c]].sort().join('|'); pairs.set(k, (pairs.get(k) || 0) + 1); seen.set(k, { i, day }); }
        // кто бывает в месте, кто там ночует (живёт), кто там днём в будни (работает)
        const pl = A.locTop(loc) || '';
        if (pl && here.length) {
            const P = atPlace.get(pl) || { who: new Map() };
            const h = HOUR(time);
            let wd = -1;
            try { const dt = A.parseDate(day); if (dt && !isNaN(dt)) wd = dt.getDay(); } catch { /* */ }
            for (const n of here) {
                const x = P.who.get(n) || { n: 0, nights: new Set(), days: new Set() };
                x.n++;
                if (h != null && day && (h >= 22 || h < 6)) x.nights.add(day);
                if (h != null && day && h >= 9 && h < 18 && wd >= 1 && wd <= 5) x.days.add(day);
                P.who.set(n, x);
            }
            atPlace.set(pl, P);
        }
        // кто кого упоминает: в тексте автора — имена других
        for (const c of cast) {
            if (A.sameName(c.name, who) || !c.re.test(text)) continue;
            const k = `${who}>${c.name}`;
            ment.set(k, (ment.get(k) || 0) + 1);
        }
    }
    // атлас мест — из глав
    const places = new Map();
    const rhythm = [];
    try {
        for (const ch of A.chapters()) {
            if (ch.end < lo || ch.start > hi) continue;
            let heat = 0, hn = 0;
            for (let i = Math.max(ch.start, lo); i <= Math.min(ch.end, hi); i++) { let h = null; try { h = A.heatOf?.(i); } catch { /* */ } if (h != null) { heat += h; hn++; } }
            rhythm.push({ title: ch.title, n: ch.count || 0, start: ch.start, heat: hn ? heat / hn : null, date: ch.date || '' });
            const name = A.locTop(ch.loc) || '';
            if (!name) continue;
            const p = places.get(name) || { name, visits: 0, posts: 0, last: '', lastMes: 0 };
            p.visits++; p.posts += ch.count || (ch.end - ch.start + 1); p.last = ch.endDate || ch.date || p.last; p.lastMes = ch.start;
            places.set(name, p);
        }
    } catch { /* глав нет */ }
    const data = {
        posts, ai, words, days, avg: ai ? Math.round(aiChars / ai) : 0, talk: aiChars ? Math.round((quoted / aiChars) * 100) : 0,
        by: [...by.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n).slice(0, 8),
        lens: lens.slice(-60),
        moods: [...moods.entries()].map(([name, dm]) => ({ name, days: dm })).filter(x => A.isOwn(x.name)).slice(0, 4),
        pairs: [...pairs.entries()].map(([k, n]) => ({ a: k.split('|')[0], b: k.split('|')[1], n })).sort((a, b) => b.n - a.n).slice(0, 8),
        places: [...places.values()].sort((a, b) => b.posts - a.posts).slice(0, 12).map(p => ({ ...p, ...placePeople(atPlace.get(p.name)) })),
        rhythm: rhythm.slice(-30),
        mentions: [...ment.entries()].map(([k, n]) => ({ a: k.split('>')[0], b: k.split('>')[1], n })).sort((a, b) => b.n - a.n).slice(0, 12),
        apart: apartPairs(pairs, seen, day, hi),
        range: range ? { from: lo, to: hi } : null,
    };
    if (!range) cache = { sig, data };
    return data;
}

/** Люди места: кто бывает чаще, кто там ночует (2+ ночи — живёт), кто там днём в будни (2+ дня — работает). */
function placePeople(P) {
    if (!P) return { regulars: [], lives: [], works: [] };
    const list = [...P.who.entries()].map(([name, x]) => ({ name, n: x.n, nights: x.nights.size, days: x.days.size }));
    const lives = list.filter(x => x.nights >= 2).sort((a, b) => b.nights - a.nights).slice(0, 3).map(x => x.name);
    const works = list.filter(x => x.days >= 2 && !lives.includes(x.name)).sort((a, b) => b.days - a.days).slice(0, 3).map(x => x.name);
    return { regulars: list.sort((a, b) => b.n - a.n).slice(0, 4).map(x => ({ name: x.name, n: x.n })), lives, works };
}
/** Пары, что часто бывали вместе, но давно не пересекались: 3+ общих постов, последний раз — 7+ дней истории или 60+ постов назад. */
function apartPairs(pairs, seen, today, last) {
    const out = [];
    const td = (() => { try { const d = A.parseDate(today); return d && !isNaN(d) ? d : null; } catch { return null; } })();
    for (const [k, n] of pairs) {
        if (n < 3) continue;
        const s = seen.get(k);
        if (!s) continue;
        let days = null;
        try { const d = A.parseDate(s.day); if (td && d && !isNaN(d)) days = Math.round((td - d) / 864e5); } catch { /* */ }
        const posts = last - s.i;
        if ((days != null && days >= 7) || posts >= 60) out.push({ a: k.split('|')[0], b: k.split('|')[1], n, days, posts, i: s.i, day: s.day });
    }
    return out.sort((a, b) => (b.days ?? 0) - (a.days ?? 0) || b.posts - a.posts).slice(0, 8);
}
/** Кого искать в текстах: персона, группа, люди Life; основа имени — чтобы «Наташу» и «Наташей» тоже ловило. */
function names() {
    const out = [];
    const add = (n) => {
        n = A.canonName(n);
        if (!n || out.some(x => A.sameName(x.name, n))) return;
        const first = String(A.shortName(n) || n).trim().split(/\s+/)[0];
        if (first.length < 3) return;
        const cyr = /[а-яё]/i.test(first);
        const base = cyr && first.length > 4 ? first.slice(0, first.length - 1) : first;
        out.push({ name: n, re: new RegExp(`(^|[^a-zа-яё])${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') });
    };
    try { add(A.ctx().name1); A.groupMembers().forEach(add); } catch { /* */ }
    return out.slice(0, 12);
}

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

/** Мир → Архив. */
export function archiveHtml() {
    if (!A?.hasChat?.()) return '<div class="lf-empty small">Открой чат.</div>';
    const d = build();
    if (!d.posts) return '<div class="lf-empty small">В чате пока нет постов.</div>';
    const tabs = [['sum', 'Обзор'], ['rel', 'Отношения'], ['places', 'Места'], ['find', 'Поиск'], ['range', 'Отрезок'], ['other', 'Другой чат']];
    const head = `${A.sec('Архив', 'вся история чата')}
    <div class="lf-chips">${tabs.map(([k, l]) => `<button class="lf-chip${ui.tab === k ? ' on' : ''}" data-act="arc-tab" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    try {
        if (ui.tab === 'rel') body = relTabHtml(d);
        else if (ui.tab === 'places') body = placesHtml(d);
        else if (ui.tab === 'find') body = findHtml();
        else if (ui.tab === 'range') body = rangeHtml();
        else if (ui.tab === 'other') body = otherHtml();
        else body = sumHtml(d, true);
    } catch (e) { console.warn('[Life] архив', e); body = `<div class="lf-empty small">${esc(String(e?.message || e))}</div>`; }
    return `${head}${body}
    <div class="lf-actions tight"><button class="lf-btn ghost" data-act="arc-json">${A.icon('file')} Выгрузить архив в JSON</button></div>`;
}

/** Сводка: числа, кто сколько пишет, длина ответов, настроение, ритм сцен, кто кого упоминает (+ истории — для всего чата). */
function sumHtml(d, full = false) {
    const num = (v, l) => `<div class="lf-ar-n"><b>${v}</b><small>${l}</small></div>`;
    const maxBy = Math.max(...d.by.map(x => x.n), 1);
    const maxLen = Math.max(...d.lens, 1);
    const lastDays = d.days.slice(-42);
    return `<div class="lf-ar-nums">${num(d.posts, A.plural(d.posts, 'пост', 'поста', 'постов'))}${num(d.days.length, A.plural(d.days.length, 'день истории', 'дня истории', 'дней истории'))}${num(d.words > 9999 ? `${Math.round(d.words / 1000)}k` : d.words, 'слов')}${num(d.avg, 'знаков в ответе')}${num(`${d.talk}%`, 'реплики')}</div>
    ${A.sec('Кто сколько пишет')}
    <div class="lf-ar-bars">${d.by.map(x => `<div class="lf-ar-b${x.user ? ' me' : ''}">${A.ava(x.name, 'xs')}<span><b>${esc(A.shortName(x.name))}</b><i><u style="width:${Math.round((x.n / maxBy) * 100)}%"></u></i></span><small>${x.n} · ${Math.round(x.chars / Math.max(1, x.n))} зн.</small></div>`).join('')}</div>
    ${d.lens.length > 3 ? `${A.sec('Длина ответов', 'последние 60')}<div class="lf-ar-lens">${d.lens.map(v => `<i style="height:${Math.max(4, Math.round((v / maxLen) * 100))}%" title="${v}"></i>`).join('')}</div>` : ''}
    ${d.moods.length ? `${A.sec('Календарь настроения', 'по лицам постов')}${d.moods.map(x => `<div class="lf-ar-mood"><div class="lf-ar-mh">${A.ava(x.name, 'xs')}<b>${esc(A.shortName(x.name))}</b></div><div class="lf-ar-grid">${lastDays.map(dd => { const o = x.days.get(dd.day); const k = o ? top(o) : ''; return `<i${k ? ` style="background:${EMO[k][1]}"` : ''} title="${esc(dd.day)}${k ? ` — ${EMO[k][0]}` : ''}"></i>`; }).join('')}</div></div>`).join('')}
        <div class="lf-ar-legend">${Object.values(EMO).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>` : full ? `<div class="lf-hint">Календарь настроения появится, когда у персонажей будут «Лица» (Персонаж → Жизнь): Летописец метит эмоцию в каждом посте.</div>` : ''}
    ${rhythmHtml(d)}
    ${d.mentions.length ? `${A.sec('Кто кого упоминает', 'в своих постах')}<div class="lf-ar-ment">${d.mentions.map(x => `<span>${A.ava(x.a, 'xs')}<i>→</i>${A.ava(x.b, 'xs')}<small>${esc(A.shortName(x.a))} о ${esc(A.shortName(x.b))}</small><b>${x.n}</b></span>`).join('')}</div>` : ''}
    ${full ? histHtml(d) : ''}`;
}

/** Ритм сцен: столбик — сцена (глава), высота — сколько постов, цвет — накал по меткам Летописца. */
function rhythmHtml(d) {
    const r = d.rhythm.filter(x => x.n > 0);
    if (r.length < 3) return '';
    const max = Math.max(...r.map(x => x.n), 1);
    const avg = Math.round(r.reduce((a, x) => a + x.n, 0) / r.length);
    const tone = (h) => (h == null ? '' : h >= 3 ? 'hot' : h >= 2 ? 'warm' : h >= 1 ? 'mild' : 'calm');
    return `${A.sec('Ритм сцен', `в среднем ${avg} ${A.plural(avg, 'пост', 'поста', 'постов')}`)}
    <div class="lf-ar-rhy">${r.map(x => `<button class="${tone(x.heat)}" style="height:${Math.max(8, Math.round((x.n / max) * 100))}%" data-act="jump" data-mes="${x.start}" title="${esc(x.title)} — ${x.n}"></button>`).join('')}</div>
    <div class="lf-ar-legend"><span><i class="lf-ar-t calm"></i>тихо</span><span><i class="lf-ar-t mild"></i>живо</span><span><i class="lf-ar-t warm"></i>накал</span><span><i class="lf-ar-t hot"></i>пик</span></div>`;
}

/** Отношения: доверие пары по истории, за что оно двигалось и шрамы, у кого ползёт вниз, давно не пересекались. */
function relTabHtml(d) {
    const out = [];
    const user = A.canonName(A.ctx().name1);
    const others = A.groupMembers().map(A.canonName).filter(n => n && !A.sameName(n, user));
    let partner = '';
    try { partner = A.bickerPartner?.() || ''; } catch { /* */ }
    if (!partner) partner = others[0] || '';
    if (partner) out.push(trustChart(partner, user));
    const falls = trustFalls([user, ...others]);
    out.push(`${A.sec('Падение доверия', falls.length ? `${falls.length}` : 'нет')}${falls.length ? `<div class="lf-ar-fall">${falls.map(f => `<button data-act="jump" data-mes="${f.at}">${A.ava(f.from, 'xs')}<i>→</i>${A.ava(f.to, 'xs')}<span><b>${esc(A.shortName(f.from))} → ${esc(A.shortName(f.to))}: ${f.peak} → ${f.now}</b><small>за ${f.posts} ${A.plural(f.posts, 'пост', 'поста', 'постов')}${f.why.length ? ` · ${esc(f.why.join('; '))}` : ''}</small></span></button>`).join('')}</div>` : '<div class="lf-hint">Ни у кого доверие сейчас не ползёт вниз (сравниваю с пиком за последние 60 постов). Запертые шкалы — любовь и близость у пар, где ты их заперла, — не в счёт.</div>'}`);
    const sc = A.chatMeta().scars || {};
    const log = (sc.log || []).filter(x => x.why).slice(-14).reverse();
    const scars = (sc.list || []).filter(x => !x.off).slice(-8).reverse();
    if (log.length || scars.length) {
        out.push(`${A.sec('Доверие: за что', String(log.length))}${log.length ? `<div class="lf-ar-why">${log.map(x => `<button class="${x.d < 0 ? 'neg' : 'pos'}" data-act="jump" data-mes="${x.mes}"><b>${x.d > 0 ? '+' : ''}${x.d}</b><span>${esc(A.shortName(x.from))} → ${esc(A.shortName(x.to))}: ${esc(x.why)}</span></button>`).join('')}</div>` : ''}
        ${scars.length ? `${A.sec('Шрамы', String(scars.length))}<div class="lf-ar-why">${scars.map(x => { let t = null; try { t = A.relOf(x.from, x.to)?.trust; } catch { /* */ } const healed = t != null && t >= x.was; return `<button class="${healed ? 'pos' : 'neg'}" data-act="jump" data-mes="${x.mes}"><b>${healed ? 'зажило' : 'болит'}</b><span>${esc(A.shortName(x.from))} → ${esc(A.shortName(x.to))}: ${esc(x.why)}${t != null ? ` · доверие ${Math.round(t)} из прежних ${x.was}` : ''}</span></button>`; }).join('')}</div>` : ''}`);
    } else out.push(`${A.sec('Доверие: за что')}<div class="lf-hint">Причины сдвигов доверия и шрамы Летописец пишет с 0.52 (Психика → «Доверие: причины и шрамы»).</div>`);
    if (d.apart.length) out.push(`${A.sec('Давно не пересекались', String(d.apart.length))}<div class="lf-ar-why">${d.apart.map(x => `<button data-act="jump" data-mes="${x.i}"><b>${A.ava(x.a, 'xs')}${A.ava(x.b, 'xs')}</b><span>${esc(A.shortName(x.a))} и ${esc(A.shortName(x.b))} — ${x.days != null && x.days >= 1 ? `${x.days} ${A.plural(x.days, 'день', 'дня', 'дней')} истории` : `${x.posts} ${A.plural(x.posts, 'пост', 'поста', 'постов')}`} не в одной сцене (вместе были ${x.n} ${A.plural(x.n, 'раз', 'раза', 'раз')})</span></button>`).join('')}</div>`);
    if (d.pairs.length) out.push(`${A.sec('Кто с кем в одной сцене')}<div class="lf-ar-pairs">${d.pairs.map(p => `<span>${A.ava(p.a, 'xs')}${A.ava(p.b, 'xs')}<b>${p.n}</b></span>`).join('')}</div>`);
    return out.join('');
}

/** У кого доверие ползёт вниз: сейчас ниже пика последних 60 постов на 10 и больше. Запертое доверие — не в счёт. */
export function trustFalls(people, win = 60) {
    const chat = A.chatArr();
    const last = chat.length - 1;
    const out = [];
    const log = A.chatMeta().scars?.log || [];
    for (const a of people) for (const b of people) {
        if (!a || !b || A.sameName(a, b)) continue;
        let s = [];
        try { s = A.relSeries?.(a, b, 'trust') || []; } catch { /* */ }
        if (s.length < 2 || s[0].i === -1 && s.length === 1) continue;   // заперто или не двигалось
        const recent = s.filter(p => p.i >= last - win);
        if (!recent.length) continue;
        const before = s.filter(p => p.i < last - win).slice(-1)[0];
        const pts = before ? [before, ...recent] : recent;
        const peak = pts.reduce((m, p) => (p.v > m.v ? p : m), pts[0]);
        const now = s[s.length - 1];
        if (peak.v - now.v < 10 || now.i <= peak.i) continue;
        const why = log.filter(x => A.sameName(x.from, a) && A.sameName(x.to, b) && x.d < 0 && x.mes > peak.i && x.why).slice(-3).map(x => x.why);
        out.push({ from: A.canonName(a), to: A.canonName(b), peak: Math.round(peak.v), now: Math.round(now.v), posts: Math.max(1, now.i - Math.max(0, peak.i)), at: now.i, why });
    }
    return out.sort((x, y) => (y.peak - y.now) - (x.peak - x.now)).slice(0, 6);
}

/** Места: визиты, кто бывает, кто живёт (ночует), кто работает (днём в будни). */
function placesHtml(d) {
    if (!d.places.length) return '<div class="lf-hint">Атлас мест собирается из глав: смены места по Horae.</div>';
    const maxPl = Math.max(...d.places.map(p => p.posts), 1);
    const who = (list, cls) => list.map(n => `<em class="${cls}">${A.ava(n, 'xs')}${esc(A.shortName(n))}</em>`).join('');
    return `${A.sec('Атлас мест', String(d.places.length))}<div class="lf-ar-atlas">${d.places.map(p => `<div class="lf-ar-pl">
        <button class="lf-ar-b pl" data-act="jump" data-mes="${p.lastMes}"><span><b>${esc(p.name)}</b><i><u style="width:${Math.round((p.posts / maxPl) * 100)}%"></u></i></span><small>${p.visits} ${A.plural(p.visits, 'раз', 'раза', 'раз')} · ${p.posts} ${A.plural(p.posts, 'пост', 'поста', 'постов')}${p.last ? ` · ${esc(p.last)}` : ''}</small></button>
        ${p.lives.length || p.works.length || p.regulars.length ? `<div class="lf-ar-pw">${p.lives.length ? `<span><small>${A.icon('home')} живёт</small>${who(p.lives, 'live')}</span>` : ''}${p.works.length ? `<span><small>${A.icon('briefcase')} работает</small>${who(p.works, 'work')}</span>` : ''}${p.regulars.length ? `<span><small>${A.icon('users')} бывает</small>${p.regulars.map(r => `<em>${A.ava(r.name, 'xs')}${esc(A.shortName(r.name))} <b>${r.n}</b></em>`).join('')}</span>` : ''}</div>` : ''}
    </div>`).join('')}</div>
    <div class="lf-hint">Живёт — там ночевал(а) две ночи и больше; работает — бывал(а) там днём в будни хотя бы дважды. По времени Horae.</div>`;
}

/** Поиск по постам, главам и событиям Horae. */
function findHtml() {
    const q = String(ui.q || '').trim();
    const res = q.length >= 2 ? search(q) : null;
    const mark = (t) => { const low = t.toLowerCase().replace(/ё/g, 'е'); const nq = q.toLowerCase().replace(/ё/g, 'е'); const at = low.indexOf(nq); return at < 0 ? esc(t) : `${esc(t.slice(0, at))}<mark>${esc(t.slice(at, at + nq.length))}</mark>${esc(t.slice(at + nq.length))}`; };
    return `<div class="lf-ar-find"><input type="search" data-in="arc-q" value="${esc(q)}" placeholder="слово, имя, место…" enterkeyhint="search"><button class="lf-btn primary" data-act="arc-find">${A.icon('search')}</button></div>
    ${res ? `${res.ch.length ? `${A.sec('Главы', String(res.ch.length))}<div class="lf-ar-res">${res.ch.map(x => `<button data-act="jump" data-mes="${x.i}"><small>${esc(x.date || `#${x.i}`)}</small><span>${mark(x.t)}</span></button>`).join('')}</div>` : ''}
    ${res.ev.length ? `${A.sec('События', String(res.ev.length))}<div class="lf-ar-res">${res.ev.map(x => `<button data-act="jump" data-mes="${x.i}"><small>${esc(x.date || `#${x.i}`)}</small><span>${mark(x.t)}</span></button>`).join('')}</div>` : ''}
    ${A.sec('Посты', res.posts.length >= 40 ? '40+' : String(res.posts.length))}${res.posts.length ? `<div class="lf-ar-res">${res.posts.map(x => `<button data-act="jump" data-mes="${x.i}"><small>#${x.i}${x.date ? ` · ${esc(x.date)}` : ''} · ${esc(A.shortName(x.who))}</small><span>…${mark(x.snip)}…</span></button>`).join('')}</div>` : '<div class="lf-hint">Ничего не нашлось.</div>'}` : '<div class="lf-hint">От двух букв. Ищу в постах (новые сверху), в названиях глав и в событиях Horae.</div>'}`;
}
function search(q) {
    const chat = A.chatArr();
    const nq = q.toLowerCase().replace(/ё/g, 'е');
    const posts = [];
    for (let i = chat.length - 1; i >= 0 && posts.length < 40; i--) {
        const m = chat[i];
        if (!A.isPost(m)) continue;
        const t = A.plainText(m.mes || '').replace(/\s+/g, ' ');
        const at = t.toLowerCase().replace(/ё/g, 'е').indexOf(nq);
        if (at < 0) continue;
        posts.push({ i, who: A.canonName(m.name || '') || m.name || '', date: m.horae_meta?.timestamp?.story_date || '', snip: t.slice(Math.max(0, at - 70), at + nq.length + 90) });
    }
    const ch = [];
    try { for (const c of A.chapters()) if (String(c.title || '').toLowerCase().replace(/ё/g, 'е').includes(nq)) ch.push({ i: c.start, t: c.title, date: c.date }); } catch { /* */ }
    const ev = [];
    try { for (const e of A.horaeEvents()) { const t = String(e.event?.summary || ''); if (t.toLowerCase().replace(/ё/g, 'е').includes(nq)) ev.push({ i: e.messageIndex, t, date: e.timestamp?.story_date || '' }); } } catch { /* */ }
    return { posts, ch: ch.slice(-12).reverse(), ev: ev.slice(-20).reverse() };
}

/** Отрезок: та же сводка по постам с № по №. */
function rangeHtml() {
    const n = A.chatArr().length - 1;
    const from = Number.isFinite(parseInt(ui.from, 10)) ? parseInt(ui.from, 10) : Math.max(0, n - 100);
    const to = Number.isFinite(parseInt(ui.to, 10)) ? parseInt(ui.to, 10) : n;
    const d = from <= to ? build({ from, to }) : null;
    return `<div class="lf-ar-range"><label>с №<input type="text" inputmode="numeric" data-in="arc-from" value="${from}"></label><label>по №<input type="text" inputmode="numeric" data-in="arc-to" value="${to}"></label><button class="lf-btn primary" data-act="arc-range">${A.icon('check')} Посчитать</button></div>
    <div class="lf-chips">${[['100', 'последние 100'], ['300', 'последние 300'], ['ch', 'эта глава'], ['all', 'весь чат']].map(([k, l]) => `<button class="lf-chip" data-act="arc-rq" data-v="${k}">${l}</button>`).join('')}</div>
    ${d && d.posts ? `${A.sec(`Посты #${d.range.from}–#${d.range.to}`)}${sumHtml(d)}${d.places.length ? `${A.sec('Где было')}<div class="lf-ar-bars">${d.places.slice(0, 6).map(p => `<div class="lf-ar-b pl"><span><b>${esc(p.name)}</b></span><small>${p.posts} ${A.plural(p.posts, 'пост', 'поста', 'постов')}</small></div>`).join('')}</div>` : ''}${d.pairs.length ? `${A.sec('Кто с кем')}<div class="lf-ar-pairs">${d.pairs.map(p => `<span>${A.ava(p.a, 'xs')}${A.ava(p.b, 'xs')}<b>${p.n}</b></span>`).join('')}</div>` : ''}` : '<div class="lf-hint">В этом отрезке нет постов.</div>'}`;
}

// ───────────── другой чат: летопись старой ветки (только чтение) ─────────────

const hdrs = () => { try { return A.ctx().getRequestHeaders(); } catch { return { 'Content-Type': 'application/json' }; } };
/** Чаты этого персонажа или группы, кроме открытого: [{ id, label }]. */
async function listChats() {
    const c = A.ctx();
    const cur = String(c.getCurrentChatId?.() || c.chatId || '');
    if (c.groupId) {
        const g = (c.groups || []).find(x => x.id === c.groupId);
        return (g?.chats || []).filter(id => String(id) !== cur).slice().reverse().map(id => ({ id: String(id), label: String(id) }));
    }
    const ch = c.characters?.[c.characterId];
    if (!ch) return [];
    const r = await fetch('/api/characters/chats', { method: 'POST', headers: hdrs(), body: JSON.stringify({ avatar_url: ch.avatar, simple: true }) });
    if (!r.ok) throw new Error(`список чатов: ${r.status}`);
    const j = await r.json();
    const list = (Array.isArray(j) ? j : Object.values(j || {})).map(x => String(x?.file_name || x || '').replace(/\.jsonl$/, '')).filter(Boolean);
    return list.filter(f => f !== cur).sort().reverse().map(f => ({ id: f, label: f }));
}
async function loadChat(id) {
    const c = A.ctx();
    let r;
    if (c.groupId) r = await fetch('/api/chats/group/get', { method: 'POST', headers: hdrs(), body: JSON.stringify({ id }) });
    else { const ch = c.characters?.[c.characterId]; r = await fetch('/api/chats/get', { method: 'POST', headers: hdrs(), body: JSON.stringify({ ch_name: ch?.name, file_name: id, avatar_url: ch?.avatar }) }); }
    if (!r.ok) throw new Error(`чат не открылся: ${r.status}`);
    const arr = await r.json();
    return chronOfFile(Array.isArray(arr) ? arr : []);
}
/** Летопись чата по его файлу: главы по смене места (как у Life), события Horae, имена глав этого чата. */
export function chronOfFile(arr) {
    const head = arr[0] && arr[0].chat_metadata ? arr[0] : null;
    const msgs = head ? arr.slice(1) : arr;
    const life = head?.chat_metadata?.life || {};
    const titles = { ...(life.autoTitles || {}), ...(life.titles || {}) };
    const chapters = [];
    const events = [];
    let loc = '', date = '', time = '', cur = null, posts = 0;
    msgs.forEach((m, i) => {
        const meta = m?.horae_meta;
        if (meta && !meta._skipHorae) { if (meta.scene?.location) loc = meta.scene.location; if (meta.timestamp?.story_date) date = meta.timestamp.story_date; if (meta.timestamp?.story_time) time = meta.timestamp.story_time; }
        const key = A.norm(A.locTop(loc) || '');
        if (!cur || (key && key !== cur.key)) { cur = { start: i, key, loc, date, time, n: 0, preview: '' }; chapters.push(cur); }
        const post = m && !m.is_system && String(m.mes || '').trim();
        if (post) { posts++; cur.n++; if (!cur.preview && !m.is_user) cur.preview = A.cut(A.plainText(m.mes).replace(/\s+/g, ' '), 150); }
        cur.endDate = date || cur.endDate;
        for (const e of meta?.events || []) if (e?.summary) events.push({ i, date, time, t: String(e.summary) });
    });
    for (const ch of chapters) ch.title = titles[ch.start] || (ch.loc ? (A.placeName ? A.placeName(A.locTop(ch.loc)) : A.locTop(ch.loc)) : ch.start === 0 ? 'Пролог' : 'Без места');
    return { posts, chapters: chapters.filter(c => c.n), events, user: head?.user_name || '', from: date };
}
function otherHtml() {
    const o = ui.other;
    if (o?.data) {
        const d = o.data;
        return `<div class="lf-actions tight"><button class="lf-btn ghost" data-act="arc-other-back">${A.icon('left')} К списку</button>${A.ctx().groupId || A.ctx().openCharacterChat ? `<button class="lf-btn ghost" data-act="arc-other-open" data-v="${esc(o.id)}">${A.icon('door')} Открыть этот чат</button>` : ''}</div>
        ${A.sec(esc(o.id), `${d.posts} ${A.plural(d.posts, 'пост', 'поста', 'постов')}`)}
        <div class="lf-hint">Только чтение: летопись другой ветки — главы по смене места и события Horae. В этот чат ничего не пишется.</div>
        ${d.chapters.length ? `${A.sec('Главы', String(d.chapters.length))}<div class="lf-timeline">${d.chapters.slice(-40).map(c => `<div class="lf-tl"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><b>${esc(c.title)}</b><small>${esc([c.date, c.endDate && c.endDate !== c.date ? `— ${c.endDate}` : ''].filter(Boolean).join(' '))} · ${c.n} ${A.plural(c.n, 'пост', 'поста', 'постов')}</small>${c.preview ? `<span class="lf-ar-prev">${esc(c.preview)}</span>` : ''}</span></div>`).join('')}</div>` : ''}
        ${d.events.length ? `${A.sec('События', String(d.events.length))}<div class="lf-timeline">${d.events.slice(-40).reverse().map(e => `<div class="lf-tl"><span class="lf-tl-dot"></span><span class="lf-tl-txt"><small>${esc([e.date, e.time].filter(Boolean).join(' '))}</small>${esc(e.t)}</span></div>`).join('')}</div>` : '<div class="lf-hint">Событий Horae в том чате нет.</div>'}`;
    }
    if (ui.busy) return `<div class="lf-hint">${esc(ui.busy)}…</div>`;
    if (!ui.chats) return `<div class="lf-hint">Летопись старой ветки этого же персонажа или группы — посмотреть, что там было, не открывая чат.</div><button class="lf-btn primary full" data-act="arc-other-list">${A.icon('book')} Показать другие чаты</button>`;
    if (!ui.chats.length) return '<div class="lf-hint">Других чатов у этого персонажа нет.</div>';
    return `<div class="lf-ar-res">${ui.chats.slice(0, 40).map(x => `<button data-act="arc-other-load" data-v="${esc(x.id)}"><small>${A.icon('book')}</small><span>${esc(x.label)}</span></button>`).join('')}</div>`;
}

/** Выгрузка: всё, что знает архив, плюс отношения, тайны, шрамы, фракции и знания — одним JSON-файлом. */
function exportJson() {
    const d = build();
    const cm = A.chatMeta();
    const c = A.ctx();
    const name = String(c.getCurrentChatId?.() || c.chatId || 'chat').replace(/[^\wа-яё .@-]+/gi, '_').slice(0, 80);
    const data = {
        app: 'Life', kind: 'archive', exported: new Date().toISOString(), chat: name,
        stats: { posts: d.posts, ai: d.ai, words: d.words, avg: d.avg, talk: d.talk, days: d.days, by: d.by, lens: d.lens },
        moods: d.moods.map(x => ({ name: x.name, days: Object.fromEntries(x.days) })),
        places: d.places, pairs: d.pairs, apart: d.apart, mentions: d.mentions, rhythm: d.rhythm,
        chapters: (() => { try { return A.chapters().map(ch => ({ title: ch.title, start: ch.start, end: ch.end, date: ch.date, endDate: ch.endDate, loc: ch.loc, posts: ch.count })); } catch { return []; } })(),
        events: (() => { try { return A.horaeEvents().map(e => ({ i: e.messageIndex, date: e.timestamp?.story_date || '', time: e.timestamp?.story_time || '', text: e.event?.summary || '' })); } catch { return []; } })(),
        relations: (() => { try { return Object.values(A.relationsState()).map(p => ({ a: p.a, b: p.b, ab: p.ab, ba: p.ba, moments: p.moments })); } catch { return []; } })(),
        secrets: (() => { try { return A.secretsState(); } catch { return []; } })(),
        scars: cm.scars || null, factions: cm.fac?.list || [], know: cm.know?.facts || [],
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-archive-${new Date().toISOString().slice(0, 10)}-${A.hash(name).slice(0, 6)}.json`;   // имя файла латиницей: айфон и Chrome режут кириллицу и пробелы
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
}

/** Поле поиска: Enter / уход из поля — искать; поля отрезка — запомнить. */
export function archiveInput(el) {
    const k = el?.dataset?.in;
    if (k === 'arc-q') { ui.q = el.value; A.render(); return true; }
    if (k === 'arc-from' || k === 'arc-to') { ui[k === 'arc-from' ? 'from' : 'to'] = el.value; return true; }
    return false;
}

export async function archiveClick(act, el) {
    if (!act.startsWith('arc-')) return false;
    const box = el.closest('.lf-body') || document;
    const val = (k) => box.querySelector(`[data-in="${k}"]`)?.value ?? '';
    switch (act) {
        case 'arc-tab': ui.tab = el.dataset.v; break;
        case 'arc-find': ui.q = val('arc-q'); break;
        case 'arc-range': ui.from = val('arc-from'); ui.to = val('arc-to'); break;
        case 'arc-rq': {
            const n = A.chatArr().length - 1;
            const v = el.dataset.v;
            if (v === 'all') { ui.from = '0'; ui.to = String(n); }
            else if (v === 'ch') { const ch = A.chapters().slice(-1)[0]; ui.from = String(ch?.start ?? 0); ui.to = String(n); }
            else { ui.from = String(Math.max(0, n - Number(v))); ui.to = String(n); }
            break;
        }
        case 'arc-json': exportJson(); A.toast('success', 'Архив выгружен в JSON', '✦ Архив'); return true;
        case 'arc-other-list':
            ui.busy = 'Ищу чаты'; A.render();
            try { ui.chats = await listChats(); } finally { ui.busy = ''; }
            break;
        case 'arc-other-load':
            ui.busy = 'Читаю чат'; A.render();
            try { ui.other = { id: el.dataset.v, data: await loadChat(el.dataset.v) }; } finally { ui.busy = ''; }
            break;
        case 'arc-other-back': ui.other = null; break;
        case 'arc-other-open': {
            const c = A.ctx();
            const id = el.dataset.v;
            try { if (c.groupId) await c.openGroupChat?.(c.groupId, id); else await c.openCharacterChat?.(id); } catch (e) { A.toast('warning', A.esc(String(e?.message || e)), '✦ Архив'); }
            return true;
        }
        default: return false;
    }
    A.render();
    return true;
}

// ───────────── истории: доверие пары, кто когда узнал, ружья, повторы, скучные зоны ─────────────

const STOP = new Set('и в во не на что как он она они его её ее их это то так же уже ещё еще бы ли с со к ко у о об от до по за из для при над под без через а но да или если когда чтобы был была было были быть есть нет ну вот там тут где кто чем тем этот эта эти тот та те свой своя свои свою себя себе мне меня ты тебя тебе вы вас нам нас мы я'.split(' '));

/** Самые частые обороты из 4 слов в последних ответах (каждый пост считается один раз). */
function repeats(n = 80) {
    const chat = A.chatArr();
    const cnt = new Map();
    let seen = 0;
    for (let i = chat.length - 1; i >= 0 && seen < n; i--) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        seen++;
        const w = A.norm(A.plainText(m.mes || '')).replace(/[^a-zа-я0-9\s-]/gi, ' ').split(/\s+/).filter(Boolean);
        const once = new Set();
        for (let k = 0; k + 4 <= w.length; k++) {
            const g = w.slice(k, k + 4);
            if (g.filter(x => !STOP.has(x) && x.length > 2).length < 2) continue;
            once.add(g.join(' '));
        }
        for (const g of once) cnt.set(g, (cnt.get(g) || 0) + 1);
    }
    return [...cnt.entries()].filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

/** Тихие полосы: 10+ ответов подряд без накала (по меткам тона Летописца). */
function boring(min = 10) {
    const chat = A.chatArr();
    const zones = [];
    let run = null;
    const flush = () => { if (run && run.n >= min) zones.push(run); run = null; };
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
        if (!m || m.is_user || m.is_system) continue;
        let h = null;
        try { h = A.heatOf?.(i); } catch { /* */ }
        if (h == null) { flush(); continue; }
        if (h <= 1) { if (!run) run = { from: i, to: i, n: 0 }; run.to = i; run.n++; } else flush();
    }
    flush();
    return zones.slice(-8);
}

function trustChart(a, b) {
    let s1 = [], s2 = [];
    try { s1 = A.relSeries?.(a, b, 'trust') || []; s2 = A.relSeries?.(b, a, 'trust') || []; } catch { /* */ }
    if (s1.length < 2 && s2.length < 2) return '';
    const last = A.chatArr().length || 1;
    const W = 320, H = 90;
    const line = (s) => { const pts = [...s, { i: last, v: s[s.length - 1].v }].map(p => `${((Math.max(0, p.i) / last) * W).toFixed(1)},${(H - 4 - (p.v / 100) * (H - 8)).toFixed(1)}`); return `<polyline points="${pts.join(' ')}"/>`; };
    const dl = (s) => s.filter(x => x.d).slice(-1)[0]?.d || '';
    return `${A.sec('Доверие пары', 'по всей истории')}
    <svg class="lf-ar-trust" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="mid"/><g class="a">${s1.length > 1 ? line(s1) : ''}</g><g class="b">${s2.length > 1 ? line(s2) : ''}</g></svg>
    <div class="lf-ar-legend"><span><i style="background:var(--lf-rose)"></i>${esc(A.shortName(a))} → ${esc(A.shortName(b))}: ${s1[s1.length - 1]?.v ?? '—'}</span><span><i style="background:#b9a4e8"></i>${esc(A.shortName(b))} → ${esc(A.shortName(a))}: ${s2[s2.length - 1]?.v ?? '—'}</span>${dl(s1) || dl(s2) ? `<span>последний сдвиг — ${esc(dl(s1) > dl(s2) ? dl(s1) : dl(s2))}</span>` : ''}</div>`;
}

function learnedRows() {
    const rows = [];
    const chat = A.chatArr();
    const dateOf = (i) => (i >= 0 ? chat[i]?.horae_meta?.timestamp?.story_date || '' : '');
    for (const f of A.chatMeta().know?.facts || []) for (const [n, h] of Object.entries(f.who || {})) if (Number.isFinite(h?.mes) && h.mes >= 0) rows.push({ i: h.mes, who: n, t: f.t, how: { saw: 'видел(а)', told: 'рассказали', overheard: 'подслушал(а)', rumor: 'слух', guessed: 'догадался(лась)' }[h.how] || '' });
    try { for (const s of A.secretsState?.() || []) rows.push({ i: s.mes, who: (s.knows || []).map(A.shortName).join(', '), t: `тайна: ${s.text}`, how: 'знали с самого начала' }); } catch { /* */ }
    return rows.sort((a, b) => b.i - a.i).slice(0, 16).map(r => ({ ...r, d: dateOf(r.i) }));
}

function histHtml() {
    const out = [];
    const lr = learnedRows();
    if (lr.length) out.push(`${A.sec('Кто когда узнал', String(lr.length))}<div class="lf-ar-learn">${lr.map(r => `<button data-act="jump" data-mes="${r.i}"><small>${esc(r.d || `#${r.i}`)}</small><span><b>${esc(A.shortName(r.who) || '—')}</b> ${r.how ? `<i>${esc(r.how)}</i> ` : ''}— ${esc(r.t)}</span></button>`).join('')}</div>`);
    let guns = [];
    try { guns = A.arcGunsHistory?.() || []; } catch { /* */ }
    if (guns.length) {
        const st = (g) => g.fired != null ? `💥 выстрелило #${g.fired}` : g.planted != null ? `🔫 заложено #${g.planted}` : '🌱 ещё не заложено';
        out.push(`${A.sec('Ружья', String(guns.length))}<div class="lf-ar-guns">${guns.slice().reverse().slice(0, 14).map(g => `<div class="${g.fired != null ? 'fired' : ''}"><b>${esc(g.t)}</b><small>→ ${esc(g.pay)} · «${esc(g.arc)}»${g.due ? ` · срок ${esc(g.due.slice(8, 10))}.${esc(g.due.slice(5, 7))}` : ''}${g.size ? ` · ${{ main: 'главное', side: 'побочное', short: 'мелочь' }[g.size] || ''}` : ''}</small><i>${st(g)}</i></div>`).join('')}</div>`);
    }
    const worn = [];
    for (const [who, list] of Object.entries(A.chatMeta().fresh?.list || {})) for (const x of list || []) if (x?.t) worn.push({ who: who === '__prose' ? 'проза' : A.shortName(who), t: x.t, n: x.n || 0 });
    const rp = repeats();
    if (worn.length || rp.length) out.push(`${A.sec('Повторы')}${worn.length ? `<div class="lf-ar-rep">${worn.sort((a, b) => b.n - a.n).slice(0, 10).map(x => `<span><i>${esc(x.who)}</i>${esc(x.t)}${x.n ? `<b>×${x.n}</b>` : ''}</span>`).join('')}</div><div class="lf-hint">Затёртое у персонажей — «Свежесть» уже просит модель их не повторять.</div>` : ''}${rp.length ? `<div class="lf-ar-rep">${rp.map(([g, c]) => `<span>${esc(g)}<b>×${c}</b></span>`).join('')}</div><div class="lf-hint">Обороты, которые повторились в последних 80 ответах.</div>` : ''}`);
    const bz = boring();
    if (bz.length) out.push(`${A.sec('Скучные зоны', String(bz.length))}<div class="lf-ar-bore">${bz.slice().reverse().map(z => `<button data-act="jump" data-mes="${z.from}"><b>#${z.from}–#${z.to}</b><small>${z.n} ответов подряд без накала</small></button>`).join('')}</div><div class="lf-hint">Тихо — не значит плохо; но если тянет — «Назревает», твист или повод для перепалки.</div>`);
    return out.join('');
}
