// Языки. Кто на чём говорит и когда переходит: злость, нежность, триггер, наедине с собой.
// Задаётся в Персонаж → Жизнь → Психика (или собирается из карточки и лорбука). Модель получает это для тех,
// кто в сцене; сейчас злость или нежность (по тону сцены), сработал триггер — подсказка к месту.
// Иностранные фразы — в оригинале, смысл — по контексту или переводом в скобках, не через строчку.

import { loreFor, cardText } from './lore.js';
import { lifeKey } from './sim.js';
import { moodNow } from './mood.js';

let A = null;
export function initLang(api) { A = api; }

const esc = (v) => A.esc(v);
const NARR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

function cfg() {
    const s = A.settings();
    if (!s.lang || typeof s.lang !== 'object') s.lang = {};
    const c = s.lang;
    if (c.on === undefined) c.on = true;
    if (!c.list || typeof c.list !== 'object') c.list = {};
    if (!c.seeded) seed(c);
    return c;
}
export const langOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;
const keyOf = (who) => { try { return lifeKey(who); } catch { return A.canonName(who) || who; } };

/** Один раз: то, что известно по канону. */
function seed(c) {
    let names = [];
    try { names = A.groupMembers().map(A.canonName); } catch { /* */ }
    if (!names.length) return;
    c.seeded = 1;
    const put = (re, v) => { const n = names.find(x => re.test(x)); if (n && !c.list[keyOf(n)]) c.list[keyOf(n)] = v; };
    put(/баки|bucky|барнс|barnes/i, { langs: 'английский (родной), русский, румынский, японский', when: 'злость и триггер — срывается на русский; нежность — может по-румынски; японский — редко, к месту' });
    put(/земо|zemo|гельмут|helmut/i, { langs: 'немецкий (родной), английский', when: 'злость, презрение и наедине с собой — по-немецки' });
    A.saveSettings();
}

export function langOf(who) {
    const x = cfg().list[keyOf(who)];
    return x && (String(x.langs || '').trim() || String(x.when || '').trim()) ? x : null;
}

// ───────────── заметка модели ─────────────

export function langPrompt(type) {
    if (!A?.hasChat?.() || !langOn() || type === 'quiet' || type === 'impersonate') return '';
    let here = [];
    try { here = (A.worldState().scene?.characters_present || []).map(A.canonName); } catch { /* */ }
    if (!here.length) here = A.groupMembers().map(A.canonName);
    const rows = here.filter(n => !NARR.test(n)).map(n => [n, langOf(n)]).filter(([, x]) => x)
        .map(([n, x]) => `${A.shortName(n)} — ${x.langs || '?'}${x.when ? `; переходит: ${x.when}` : ''}`);
    if (!rows.length) return '';
    let now = '';
    try {
        const md = moodNow();
        const v = md?.manual || md?.auto || '';
        if (['fight', 'danger', 'tension'].includes(v)) now = ' Сейчас в сцене злость и напряжение.';
        else if (['tender', 'comfort'].includes(v) || md?.intimOn) now = ' Сейчас в сцене нежность.';
    } catch { /* */ }
    return `[Языки: ${rows.join('. ')}.${now} Переходят, когда к месту, — коротко и в оригинале, смысл по контексту или переводом в скобках; не через строчку.]`;
}

// ───────────── из карточки и лорбука ─────────────

const SYSTEM = `По карточке и записям лорбука о персонаже ролевой истории выпиши, какими языками он владеет и когда переходит с одного на другой (злость, страх, триггер, нежность, интимность, наедине с собой, с кем-то конкретным).
Ответь только JSON: {"langs":"языки через запятую, родной — с пометкой (родной)","when":"когда на какой переходит, коротко через ;"}. Чего нет в текстах — не выдумывай: пустая строка.`;

async function collect(who) {
    const name = A.canonName(who);
    const card = cardText(name, 4000);
    let lore = '';
    try { lore = await loreFor(name, { re: /язык|говор|акцент|русск|немец|румын|япон|франц|испан|language|accent|speaks/i, max: 9000 }); } catch { /* */ }
    if (!card && !lore) throw new Error('ни карточки, ни лорбука о нём не нашлось');
    const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: [`Персонаж: ${name}`, card ? `Карточка:\n${card}` : '', lore ? `Лорбук:\n${lore}` : ''].filter(Boolean).join('\n\n') }], 500);
    const j = A.extractJson(out);
    const langs = String(j?.langs || '').trim().slice(0, 200);
    const when = String(j?.when || '').trim().slice(0, 300);
    if (!langs && !when) throw new Error('про языки ничего не нашлось');
    const c = cfg();
    const old = c.list[keyOf(name)] || {};
    c.list[keyOf(name)] = { langs: langs || old.langs || '', when: when || old.when || '' };
    A.saveSettings();
}

// ───────────── Персонаж → Жизнь → Психика ─────────────

export function langHtml(who) {
    if (!A?.hasChat?.() || NARR.test(who)) return '';
    const x = cfg().list[keyOf(who)] || {};
    const N = esc(who);
    return `${A.sec('Языки', x.langs ? esc(A.cut(x.langs, 40)) : '')}
    <div class="lf-field"><label>На чём говорит</label><input type="text" data-in="lg-langs" data-name="${N}" value="${esc(x.langs || '')}" placeholder="английский (родной), русский…"></div>
    <div class="lf-field"><label>Когда переходит</label><input type="text" data-in="lg-when" data-name="${N}" value="${esc(x.when || '')}" placeholder="злость — по-русски; нежность — …"></div>
    <div class="lf-actions"><button class="lf-btn ghost" data-act="lg-collect" data-name="${N}">${A.icon('book')} Собрать из карточки и лорбука</button></div>`;
}

export function langInput(el) {
    const k = el.dataset.in;
    if (k !== 'lg-langs' && k !== 'lg-when') return false;
    const c = cfg();
    const key = keyOf(el.dataset.name);
    const x = c.list[key] || (c.list[key] = { langs: '', when: '' });
    x[k === 'lg-langs' ? 'langs' : 'when'] = String(el.value || '').trim().slice(0, 300);
    if (!x.langs && !x.when) delete c.list[key];
    A.saveSettings();
    try { A.updatePrompt?.(); } catch { /* */ }
    return true;
}

export async function langClick(act, el) {
    if (act !== 'lg-collect') return false;
    await A.withBusy(el, async () => { await collect(el.dataset.name); A.toast('success', 'Языки записаны', '✦ Языки', { timeOut: 1800 }); A.render?.(); }, 'Читаю…');
    return true;
}
