// Архив. Сводка по всей истории чата без единого запроса к модели: сколько постов и дней, кто сколько пишет,
// длина ответов, доля реплик, календарь настроения (по лицам, которые Летописец ставит постам), атлас мест
// и кто с кем чаще в одной сцене. Мир → Архив. Идея — «Архив HUD: статистика, настроение, атлас мест»
// TavernOS HUD (alewwi), см. NOTICE-HUD.md.

let A = null;
export function initArchive(api) { A = api; }
const esc = (v) => A.esc(v);

const EMO = { calm: ['спокоен', '#8fa3a8'], tender: ['нежно', '#e8a0b4'], laugh: ['смеётся', '#f0c96a'], flirt: ['дерзко', '#e07a5f'], angry: ['зол', '#c8324a'], sad: ['грусть', '#6f86c9'], tense: ['на взводе', '#d9a441'], tired: ['устал', '#7d7388'] };

let cache = { sig: '', data: null };

function build() {
    const chat = A.chatArr();
    const sig = `${chat.length}:${A.hash(chat[chat.length - 1]?.mes || '')}`;
    if (cache.sig === sig && cache.data) return cache.data;
    const by = new Map();          // автор → { n, chars }
    const days = [];               // дни истории по порядку
    const dayIdx = new Map();
    const moods = new Map();       // имя → Map(день → { эмоция: n })
    const pairs = new Map();       // «a|b» → постов вместе
    const lens = [];
    let ai = 0, aiChars = 0, quoted = 0, posts = 0, words = 0;
    let day = '';
    for (let i = 0; i < chat.length; i++) {
        const m = chat[i];
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
        for (let a = 0; a < here.length; a++) for (let c = a + 1; c < here.length; c++) { const k = [here[a], here[c]].sort().join('|'); pairs.set(k, (pairs.get(k) || 0) + 1); }
    }
    // атлас мест — из глав
    const places = new Map();
    try {
        for (const ch of A.chapters()) {
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
        places: [...places.values()].sort((a, b) => b.posts - a.posts).slice(0, 12),
    };
    cache = { sig, data };
    return data;
}

const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

/** Мир → Архив. */
export function archiveHtml() {
    if (!A?.hasChat?.()) return '<div class="lf-empty small">Открой чат.</div>';
    const d = build();
    if (!d.posts) return '<div class="lf-empty small">В чате пока нет постов.</div>';
    const num = (v, l) => `<div class="lf-ar-n"><b>${v}</b><small>${l}</small></div>`;
    const maxBy = Math.max(...d.by.map(x => x.n), 1);
    const maxLen = Math.max(...d.lens, 1);
    const lastDays = d.days.slice(-42);
    const maxPl = Math.max(...d.places.map(p => p.posts), 1);
    return `${A.sec('Архив', 'вся история чата')}
    <div class="lf-ar-nums">${num(d.posts, A.plural(d.posts, 'пост', 'поста', 'постов'))}${num(d.days.length, A.plural(d.days.length, 'день истории', 'дня истории', 'дней истории'))}${num(d.words > 9999 ? `${Math.round(d.words / 1000)}k` : d.words, 'слов')}${num(d.avg, 'знаков в ответе')}${num(`${d.talk}%`, 'реплики')}</div>
    ${A.sec('Кто сколько пишет')}
    <div class="lf-ar-bars">${d.by.map(x => `<div class="lf-ar-b${x.user ? ' me' : ''}">${A.ava(x.name, 'xs')}<span><b>${esc(A.shortName(x.name))}</b><i><u style="width:${Math.round((x.n / maxBy) * 100)}%"></u></i></span><small>${x.n} · ${Math.round(x.chars / Math.max(1, x.n))} зн.</small></div>`).join('')}</div>
    ${d.lens.length > 3 ? `${A.sec('Длина ответов', 'последние 60')}<div class="lf-ar-lens">${d.lens.map(v => `<i style="height:${Math.max(4, Math.round((v / maxLen) * 100))}%" title="${v}"></i>`).join('')}</div>` : ''}
    ${d.moods.length ? `${A.sec('Календарь настроения', 'по лицам постов')}${d.moods.map(x => `<div class="lf-ar-mood"><div class="lf-ar-mh">${A.ava(x.name, 'xs')}<b>${esc(A.shortName(x.name))}</b></div><div class="lf-ar-grid">${lastDays.map(dd => { const o = x.days.get(dd.day); const k = o ? top(o) : ''; return `<i${k ? ` style="background:${EMO[k][1]}"` : ''} title="${esc(dd.day)}${k ? ` — ${EMO[k][0]}` : ''}"></i>`; }).join('')}</div></div>`).join('')}
        <div class="lf-ar-legend">${Object.values(EMO).map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}</div>` : `<div class="lf-hint">Календарь настроения появится, когда у персонажей будут «Лица» (Персонаж → Жизнь): Летописец метит эмоцию в каждом посте.</div>`}
    ${d.places.length ? `${A.sec('Атлас мест')}<div class="lf-ar-bars">${d.places.map(p => `<button class="lf-ar-b pl" data-act="jump" data-mes="${p.lastMes}"><span><b>${esc(p.name)}</b><i><u style="width:${Math.round((p.posts / maxPl) * 100)}%"></u></i></span><small>${p.visits} ${A.plural(p.visits, 'раз', 'раза', 'раз')} · ${p.posts} ${A.plural(p.posts, 'пост', 'поста', 'постов')}${p.last ? ` · ${esc(p.last)}` : ''}</small></button>`).join('')}</div>` : ''}
    ${d.pairs.length ? `${A.sec('Кто с кем в одной сцене')}<div class="lf-ar-pairs">${d.pairs.map(p => `<span>${A.ava(p.a, 'xs')}${A.ava(p.b, 'xs')}<b>${p.n}</b></span>`).join('')}</div>` : ''}
    ${histHtml(d)}`;
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
    const user = A.canonName(A.ctx().name1);
    let partner = '';
    try { partner = A.bickerPartner?.() || ''; } catch { /* */ }
    if (!partner) partner = A.groupMembers().map(A.canonName).find(n => n && !A.sameName(n, user)) || '';
    if (partner) out.push(trustChart(partner, user));
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
