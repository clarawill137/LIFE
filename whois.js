// Кто где. Где сейчас каждый из главных (и люди «за кадром» из Закулисья) и чем занят:
// в сцене — по Horae и мизансцене; за кадром — по повестке (где / сейчас); иначе — где видели последний раз.
// На карте — фишки на метках мест, под картой — список с делами.

import { agendaOf } from './agenda.js';
import { stageOf } from './stage.js';

let A = null;
export function initWhois(api) { A = api; }

const esc = (v) => A.esc(v);

function roster() {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    add(A.ctx().name1);
    for (const n of A.groupMembers()) add(n);
    try { for (const x of A.peopleList?.() || []) if (x?.bs && x.name) add(x.name); } catch { /* */ }
    return out;
}

/** Место из текста повестки: самое длинное известное место, чьё имя встречается в тексте. */
function placeIn(text) {
    const t = A.norm(text);
    if (!t) return '';
    let best = '', len = 0;
    for (const [, raw] of A.knownLocations()) {
        for (const part of [A.locLeaf(raw), A.locTop(raw)]) {
            const p = A.norm(part);
            if (p.length < 4) continue;
            const stem = p.length > 6 ? p.slice(0, -2) : p;
            if (t.includes(stem) && stem.length > len) { best = raw; len = stem.length; }
        }
    }
    return best;
}

// глагол — конец места: «в мастерской Башни Старка чинит перчатку» → «в мастерской Башни Старка»
const VERB = /(ет|ит|ют|ут|ат|ят|ёт|ал|ала|али|ало|ался|алась|ется|ится|ешь|ишь|ёшь|ает|яет|ует)$/i;
/** Место из текста дела, если оно не из известных Life: «в камере», «в берлинском офисе А.И.М.». */
export function placeGuess(text) {
    const t = String(text || '');
    const m = t.match(/(?:^|[\s,(])((?:в|во|на|у)\s+[^,;:!?()\n]{2,60})/i);
    if (!m) return '';
    const words = m[1].split(/\s+/);
    const out = [words[0]];
    for (const w of words.slice(1)) {
        if (out.length >= 5 || (out.length > 1 && VERB.test(w.replace(/[^а-яёa-z]/gi, '')))) break;
        out.push(w);
        if (/[.!?]$/.test(w) && !/^[А-ЯЁA-Z.]+$/.test(w)) break;
    }
    let res = out.join(' ').replace(/[\s,—–-]+$/, '');
    if (/[а-яёa-z]\.$/.test(res)) res = res.slice(0, -1);
    return res.split(/\s+/).length >= 2 ? res : '';
}

function lastSeen(name) {
    const chat = A.chatArr();
    for (let i = chat.length - 1; i >= 0; i--) {
        const h = chat[i]?.horae_meta?.scene;
        if (h?.location && (h.characters_present || []).some(n => A.sameName(n, name))) return { loc: h.location, mes: i };
    }
    return null;
}

/** [{ who, loc, key, doing, src: scene|agenda|seen|none, mes }] */
export function whereAll() {
    const st = A.worldState();
    const here = (st.scene?.characters_present || []).map(A.canonName);
    const sceneLoc = st.scene?.location || '';
    const out = [];
    for (const n of roster()) {
        if (here.some(h => A.sameName(h, n)) && sceneLoc) {
            const p = stageOf(n);
            out.push({ who: n, loc: sceneLoc, key: A.placeKey(sceneLoc), doing: p ? [p.at, p.pose].filter(Boolean).join(', ') : 'в сцене', src: 'scene' });
            continue;
        }
        let a = null;
        try { a = agendaOf(n); } catch { /* */ }
        const where = String(a?.where || '').trim();
        const doing = String(a?.now || '').trim();
        const known = placeIn(where) || placeIn(doing);
        if (known || where) { out.push({ who: n, loc: known || where, key: known ? A.placeKey(known) : '', doing, src: 'agenda' }); continue; }
        // место не из известных — но в деле оно есть («сидит в камере», «в берлинском офисе»)
        const guess = placeGuess(doing);
        if (guess) { out.push({ who: n, loc: guess, key: '', doing, src: 'agenda', guess: true }); continue; }
        const seen = lastSeen(n);
        if (seen) out.push({ who: n, loc: seen.loc, key: A.placeKey(seen.loc), doing: doing || 'там видели последний раз', src: 'seen', mes: seen.mes });
        else out.push({ who: n, loc: '', key: '', doing, src: 'none' });
    }
    return out;
}

/** Кто сейчас на этой метке карты (или внутри неё: квартира → кухня). */
export function whoAtPin(pinKey, list = whereAll()) {
    return list.filter(x => x.key && (x.key === pinKey || x.key.startsWith(`${pinKey}·`)));
}

export function whoisHtml(list = whereAll()) {
    if (!list.length) return '';
    const src = { scene: 'в сцене', agenda: 'за кадром', seen: 'видели', none: '' };
    return `${A.sec('Кто где', 'сейчас')}
    <div class="lf-whois">${list.map(x => `<div class="lf-who-r${x.src === 'scene' ? ' here' : ''}">
        ${A.ava(x.who, 'sm')}
        <span class="lf-who-t"><b>${esc(A.shortName(x.who))}</b><small>${x.loc ? esc(x.guess ? x.loc : A.locParts(x.loc).slice(-2).join(' · ')) : 'где — неизвестно'}${src[x.src] ? ` · ${src[x.src]}` : ''}</small>${x.doing ? `<em>${esc(A.cut(x.doing, 120))}</em>` : ''}</span>
        ${x.loc && x.key ? `<button class="lf-iconbtn" data-act="place" data-key="${esc(x.key)}" data-loc="${esc(x.loc)}" title="место">${A.icon('pin')}</button>` : ''}
    </div>`).join('')}</div>
    <div class="lf-hint">За кадром — по Закулисью (обновляется раз в несколько постов), в сцене — по Horae и мизансцене.</div>`;
}
