// Кто что знает. Летописец ведёт сведения, которые знают НЕ ВСЕ: что случилось без свидетелей, что сказали
// наедине, чужие тайны и решения, о которых молчат, — и кто именно в курсе (видел, рассказали, подслушал,
// слух, догадался). Тому, кто сейчас пишет ответ, модель получает список того, чего он НЕ знает: ссылаться на
// это он не может. Проговорился — под ответом «⚠ не мог знать»: «он знает» или «исправить» (меняется одна фраза).
// «Тайны» Life остаются как были; это шире — любое знание, не только секрет.

import { str, arr, similar, mains, mount } from './hudkit.js';

let A = null;
export function initKnow(api) { A = api; }
const esc = (v) => A.esc(v);

const HOW = { saw: 'был рядом', told: 'рассказали', overheard: 'подслушал', rumor: 'слух', guessed: 'догадался' };

function cfg() {
    const s = A.settings();
    if (!s.know || typeof s.know !== 'object') s.know = {};
    if (s.know.on === undefined) s.know.on = true;
    return s.know;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.know || typeof cm.know !== 'object') cm.know = {};
    const s = cm.know;
    if (!Array.isArray(s.facts)) s.facts = [];        // { id, t, who: { имя: как }, mes, pub }
    if (!s.leaks || typeof s.leaks !== 'object') s.leaks = {};   // пост → { h, list: [{ who, id, quote, st }] }
    if (!Number.isFinite(s.seq)) s.seq = 0;
    return s;
}
const everyone = () => [A.canonName(A.ctx().name1), ...mains(A)].filter(Boolean);
const knows = (f, who) => f.pub || Object.keys(f.who || {}).some(n => A.sameName(n, who));
const live = () => M().facts.filter(f => !f.pub && !everyone().every(n => knows(f, n)));
const leakOf = (i) => { const e = M().leaks[i]; const m = A.chatArr()[i]; return e && m && e.h === A.hash(m.mes || '') ? e : null; };

const RULE = `
facts — значимые сведения из этого поста, которые знают НЕ ВСЕ герои (событие без части героев, разговор наедине, находка, чужая тайна, решение, о котором молчат): [{"t":"что именно, 5-16 слов","who":["кто теперь это знает: был рядом и видел или слышал, либо ему сказали"],"how":"saw|told|overheard|rumor|guessed"}]. Общеизвестное, мелочи и то, что уже есть в «Что знают не все», не пиши. До 3. Нечего — [].
learned — кто в этом посте УЗНАЛ то, что уже есть в «Что знают не все»: [{"id":"k4","who":"имя","how":"told|overheard|rumor|guessed|saw"}]. Нечего — [].
leaks — персонаж в этом посте говорит или действует так, будто знает то, чего по списку «Что знают не все» знать НЕ может (его нет среди знающих, и в самом посте ему этого не сообщили и он этого не увидел): [{"who":"имя","id":"k4","quote":"точная фраза из поста, 3-12 слов","why":"что именно он не мог знать, 3-10 слов"}]. Только явные случаи, не догадки по видимым признакам. Нечего — [].`;

/** Мост: тайны, которые who держит от from, — то, что он знает, а тот нет: { n, list }. */
export function knowKept(who, from) {
    try {
        if (!A?.hasChat?.() || !on()) return { n: 0, list: [] };
        const list = M().facts.filter(f => !f.pub && knows(f, who) && !knows(f, from)).map(f => f.t);
        return { n: list.length, list: list.slice(-6) };
    } catch { return { n: 0, list: [] }; }
}

export function knowChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const rows = live().slice(-14).map(f => `[${f.id}] ${f.t} — знают: ${Object.keys(f.who).map(A.shortName).join(', ') || 'никто из героев'}`);
    return { key: '"facts": [], "learned": [], "leaks": []', rule: RULE, tokens: 280, input: `Что знают не все: ${rows.length ? rows.join(' | ') : 'пока пусто'}` };
}

export function knowAfterPost(i, j, m) {
    if (!on()) return;
    const s = M();
    // свайп: убрать записанное этим постом
    s.facts = s.facts.filter(f => !(f.mes === i && f.src === 'post'));
    for (const f of s.facts) for (const [n, h] of Object.entries(f.who)) if (h?.mes === i) delete f.who[n];
    delete s.leaks[i];
    let changed = false;
    for (const r of arr(j?.facts).slice(0, 3)) {
        const t = str(r?.t, 140);
        const who = arr(r?.who).map(n => A.canonName(str(n, 50))).filter(Boolean).slice(0, 8);
        if (!t || s.facts.some(f => similar(A, f.t, t, 0.7))) continue;
        const how = HOW[str(r?.how)] ? str(r.how) : 'saw';
        s.facts.push({ id: `k${++s.seq}`, t, who: Object.fromEntries(who.map(n => [n, { how, mes: i }])), mes: i, src: 'post' });
        changed = true;
    }
    for (const r of arr(j?.learned).slice(0, 6)) {
        const f = s.facts.find(x => x.id === str(r?.id));
        const who = A.canonName(str(r?.who, 50));
        if (!f || !who || knows(f, who)) continue;
        f.who[who] = { how: HOW[str(r?.how)] ? str(r.how) : 'told', mes: i };
        changed = true;
    }
    const leaks = arr(j?.leaks).slice(0, 3).map(r => ({ who: A.canonName(str(r?.who, 50)), id: str(r?.id, 12), quote: str(r?.quote, 160), why: str(r?.why, 110) }))
        .filter(r => { const f = s.facts.find(x => x.id === r.id); return r.who && r.quote && f && !knows(f, r.who); });
    if (leaks.length) { s.leaks[i] = { h: A.hash((m || A.chatArr()[i])?.mes || ''), list: leaks }; changed = true; }
    if (s.facts.length > 160) s.facts.splice(0, s.facts.length - 160);
    const keys = Object.keys(s.leaks).map(Number).sort((a, b) => a - b);
    for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete s.leaks[k];
    if (changed) { A.saveMeta(); A.paintSoon?.(); }
}

export function knowPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const facts = live();
    if (!facts.length) return '';
    const user = A.canonName(A.ctx().name1);
    const S = A.canonName(String(A.ctx().name2 || '').trim());
    const list = mains(A);
    const blind = (who) => facts.filter(f => !knows(f, who)).slice(-6).map(f => f.t);
    const rule = 'ссылаться на это, намекать или действовать, исходя из этого, нельзя; узнает — если скажут, увидит сам или поймёт по явным признакам прямо в сцене';
    // ход конкретного героя — только его слепые пятна; рассказчик — у каждого, кто в сцене
    if (S && list.some(n => A.sameName(n, S))) {
        const b = blind(S);
        return b.length ? `[Чего ${A.shortName(S)} НЕ знает (не был рядом, ему не говорили): ${b.join('; ')}. ${A.cap(rule)}.]` : '';
    }
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const rows = list.filter(n => !here.length || here.some(h => A.sameName(h, n))).map(n => { const b = blind(n).slice(-4); return b.length ? `${A.shortName(n)} — ${b.join('; ')}` : ''; }).filter(Boolean);
    const mine = blind(user).slice(-3);
    if (!rows.length && !mine.length) return '';
    return `[Кто чего НЕ знает: ${[...rows, mine.length ? `${A.shortName(user)} — ${mine.join('; ')}` : ''].filter(Boolean).join(' | ')}. Для того, кто не знает, — ${rule}.]`;
}

export function paintKnow(el, id) {
    const m = A.chatArr()[id];
    const e = on() && m && !m.is_user ? leakOf(id) : null;
    const list = (e?.list || []).filter(x => !x.st);
    if (!list.length) { mount(el, 'lf-kw', '', A.hash); return; }
    mount(el, 'lf-kw', `<div class="lf-kw lf-own">${list.map((x) => { const k = e.list.indexOf(x); return `<div class="lf-kw-i"><span>⚠ <b>${esc(A.shortName(x.who))}</b> не мог знать: ${esc(x.why || 'это')} <i>«${esc(A.cut(x.quote, 70))}»</i></span><span class="lf-kw-b"><button data-act="kw-fix" data-mes="${id}" data-n="${k}">исправить</button><button data-act="kw-ok" data-mes="${id}" data-n="${k}">он знает</button><button data-act="kw-no" data-mes="${id}" data-n="${k}">✕</button></span></div>`; }).join('')}</div>`, A.hash);
}

const factRow = (f) => `<div class="lf-kw-f"><div class="lf-kw-t">${esc(f.t)}<button data-act="kw-del" data-id="${f.id}" title="убрать">${A.icon('x')}</button></div>
    <div class="lf-kw-w">${everyone().map(n => `<button class="${knows(f, n) ? 'on' : ''}" data-act="kw-tog" data-id="${f.id}" data-who="${esc(n)}" title="${esc(A.shortName(n))}: ${knows(f, n) ? (HOW[f.who[Object.keys(f.who).find(k => A.sameName(k, n))]?.how] || 'знает') : 'не знает'}">${A.ava(n, 'xs')}</button>`).join('')}<button class="all" data-act="kw-pub" data-id="${f.id}">знают все</button></div></div>`;

export function knowSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const facts = live();
    const head = A.sec('Кто что знает', facts.length ? `${facts.length} не для всех` : '');
    if (!facts.length) return `${head}<div class="lf-hint">Летописец запишет, что случилось не при всех, — и модель перестанет давать героям знание, которого у них нет. <button class="lf-link" data-act="kw-add">+ своё</button></div>`;
    return `${head}<div class="lf-kws">${facts.slice(-5).reverse().map(factRow).join('')}</div>
    <div class="lf-chips wrap">${facts.length > 5 ? `<button class="lf-chip" data-act="kw-all">все ${facts.length}</button>` : ''}<button class="lf-chip" data-act="kw-add">${A.icon('plus')} своё</button></div>
    <div class="lf-hint">Яркая аватарка — знает. Тап — переключить.</div>`;
}

export async function knowClick(act, el) {
    if (!act.startsWith('kw-')) return false;
    const s = M();
    const f = s.facts.find(x => x.id === el.dataset.id);
    const i = Number(el.dataset.mes), n = Number(el.dataset.n);
    const lk = Number.isFinite(i) ? s.leaks[i]?.list?.[n] : null;
    switch (act) {
        case 'kw-tog': if (f) { const who = el.dataset.who; const k = Object.keys(f.who).find(x => A.sameName(x, who)); if (k) delete f.who[k]; else f.who[who] = { how: 'told', mes: -1 }; } break;
        case 'kw-pub': if (f) f.pub = true; break;
        case 'kw-del': if (f) s.facts = s.facts.filter(x => x !== f); break;
        case 'kw-all': A.openSheet(`${A.icon('eye')} Кто что знает`, `<div class="lf-kws">${live().slice().reverse().map(factRow).join('')}</div>`); return true;
        case 'kw-add': {
            A.openSheet(`${A.icon('eye')} Своё знание`, `<div class="lf-field"><label>Что именно</label><input type="text" data-in="kw-t" placeholder="Хеди встречалась с Вальденом"></div>
                <div class="lf-field"><label>Кто знает</label><div class="lf-chips wrap">${everyone().map(x => `<label class="lf-chip"><input type="checkbox" data-in="kw-w" value="${esc(x)}"> ${esc(A.shortName(x))}</label>`).join('')}</div></div>
                <button class="lf-btn primary full" data-act="kw-save">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'kw-save': {
            const box = el.closest('.lf-sheet') || document;
            const t = box.querySelector('[data-in="kw-t"]')?.value?.trim();
            if (!t) return true;
            const who = [...box.querySelectorAll('[data-in="kw-w"]:checked')].map(x => x.value);
            s.facts.push({ id: `k${++s.seq}`, t: t.slice(0, 140), who: Object.fromEntries(who.map(x => [x, { how: 'told', mes: -1 }])), mes: -1, src: 'me' });
            A.closeSheet();
            break;
        }
        case 'kw-ok': if (lk) { lk.st = 'ok'; const ff = s.facts.find(x => x.id === lk.id); if (ff) ff.who[lk.who] = { how: 'guessed', mes: i }; } break;
        case 'kw-no': if (lk) lk.st = 'off'; break;
        case 'kw-fix': {
            if (!lk) return true;
            const ff = s.facts.find(x => x.id === lk.id);
            A.toast('info', 'Переписываю фразу…', '✦ Кто что знает', { timeOut: 2500 });
            try {
                await A.rewriteFor(i, lk.quote, lk.who, `${A.shortName(lk.who)} этого не знает: «${ff?.t || lk.why}». Убери из фразы это знание: пусть спросит, промолчит или скажет то, что знает на самом деле`);
                lk.st = 'fixed';
            } catch (e) { A.toast('warning', esc(String(e?.message || e)), '✦ Кто что знает'); return true; }
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.paintSoon?.(); A.render();
    return true;
}

export function knowRecs(i) {
    const s = M();
    const out = [];
    for (const f of s.facts) {
        if (f.mes === i && f.src === 'post') out.push({ id: `kw:${f.id}`, g: 'Знания', icon: 'eye', t: `знают не все: ${f.t} (${Object.keys(f.who).map(A.shortName).join(', ') || 'никто'})`, del: () => { s.facts = s.facts.filter(x => x !== f); } });
        else for (const [n, h] of Object.entries(f.who)) if (h?.mes === i) out.push({ id: `kw:${f.id}:${n}`, g: 'Знания', icon: 'eye', t: `${A.shortName(n)} узнал(а): ${f.t}`, del: () => { delete f.who[n]; } });
    }
    return out;
}

/** Записать знание со стороны (например, из «Подслушанного»): что и кто знает. */
export function knowAdd(t, who = []) {
    const s = M();
    const text = str(t, 140);
    if (!text || s.facts.some(f => similar(A, f.t, text, 0.7))) return false;
    s.facts.push({ id: `k${++s.seq}`, t: text, who: Object.fromEntries(who.map(n => [A.canonName(n), { how: 'saw', mes: -1 }])), mes: -1, src: 'me' });
    A.saveMeta(); A.updatePrompt();
    return true;
}
