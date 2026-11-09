// Канон и эпоха для ляп-фикса. Из лорбука-таймлайна (записи с хронологией, датами, «запрещёнными ошибками»,
// правилами вселенной) дешёвая модель один раз выписывает жёсткие факты канона коротким списком — его можно
// поправить руками. Летописец сверяет с ним каждый пост вместе с эпохой по дате истории: анахронизмы и расхождения
// с каноном — тем же чипом ⚠, что и остальные ляпы. Лорбук поменялся — список соберётся заново (если не правила сама).

import { storyYear } from './era.js';
import { eraVisible, eraBooks } from './lore.js';

let A = null;
export function initCanon(api) { A = api; }

function cfg() {
    const s = A.settings();
    if (!s.canon || typeof s.canon !== 'object') s.canon = {};
    const c = s.canon;
    if (c.on === undefined) c.on = true;
    if (typeof c.text !== 'string') c.text = '';
    return c;
}
export const canonOn = () => !!A && A.settings().enabled !== false && cfg().on !== false;

const TL_RE = /хронолог|таймлайн|timeline|chronolog|канон|canon|по годам|запрещ[её]нн|правила вселенной/i;

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

/** Записи о хронологии и правилах из подключённых лорбуков: { text, sig }. */
export async function timelineLore(W = null) {
    W = W || await wiMod();
    if (!W?.loadWorldInfo) return { text: '', sig: '' };
    const c = A.ctx();
    const books = new Set();
    if (c.chatMetadata?.world_info) books.add(c.chatMetadata.world_info);
    for (const ch of A.chatCards?.() || []) {
        if (ch?.data?.extensions?.world) books.add(ch.data.extensions.world);
        (W.world_info?.charLore || []).find(e => e.name === ch.avatar)?.extraBooks?.forEach(b => books.add(b));
    }
    (W.selected_world_info || []).forEach(b => books.add(b));
    eraBooks().forEach(b => books.add(b));   // книги эпохи — ядро подключает их само
    const parts = [];
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        const bookHit = TL_RE.test(`${b} ${data?.name || ''} ${data?.description || ''}`);
        for (const e of await eraVisible(data?.entries, b)) {   // только своя эпоха и дата (ядро таймлайна)
            const t = String(e?.content || '').trim();
            if (e?.disable || !t) continue;
            const head = `${e.comment || ''} ${(e.key || []).join(' ')}`;
            // жёсткое: хронология, даты, правила, «запрещённые ошибки»; из книги-таймлайна — ещё и постоянные записи
            const strong = TL_RE.test(head) || /ЗАПРЕЩ[ЁЕ]ННЫЕ|ЖЁСТКИЙ КАНОН|ЖЕСТКИЙ КАНОН/i.test(t.slice(0, 600));
            if (!strong && !(bookHit && e.constant)) continue;
            parts.push({ p: (e.constant ? 0 : 1) + (strong ? 0 : 1), s: `### ${e.comment || (e.key || []).join(', ') || b}\n${t.slice(0, 7000)}` });
        }
    }
    parts.sort((a, b) => a.p - b.p);
    let text = '';
    for (const x of parts) { if (text.length + x.s.length > 16000) break; text += (text ? '\n\n' : '') + x.s; }
    return { text, sig: text ? A.hash(text) : '' };
}

const SYSTEM = `Ты ведёшь канон длинной литературной ролевой (фанфик по MCU, своя AU). Ниже — записи лорбука о хронологии и правилах этой вселенной.
Выпиши ЖЁСТКИЕ ФАКТЫ, о которые модель-рассказчик чаще всего спотыкается: какой сейчас год в истории и что ещё не случилось; кто где был в какие годы; кто был мёртв, пылью, в бегах — и когда; кто кого знал и с какого времени; ключевые даты, возраст; явно названные «запрещённые ошибки».
8–18 строк, каждая 5–25 слов, сухо, без пересказа сюжета. Ответь только JSON: {"facts":["…"]}`;

let busy = false;
let tried = '';

/** Собрать факты из лорбука. */
export async function canonCollect() {
    if (busy) throw new Error('уже собираю');
    busy = true;
    try {
        const { text, sig } = await timelineLore();
        if (!text) throw new Error('в подключённых лорбуках не нашлось хронологии или канона');
        tried = sig;
        const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: text }], 1400);
        const j = A.extractJson(out);
        const facts = (Array.isArray(j?.facts) ? j.facts : []).map(x => String(x || '').replace(/^[•\-–—*\s]+/, '').trim()).filter(x => x.length > 6).slice(0, 20);
        if (!facts.length) throw new Error('модель не выписала фактов');
        const c = cfg();
        c.text = facts.map(f => `• ${f}`).join('\n');
        c.sig = sig;
        c.at = Date.now();
        c.hand = false;
        A.saveSettings();
        return facts.length;
    } finally { busy = false; }
}

/** Фоном (открыли чат): фактов нет или лорбук поменялся, а руками не правили — собрать. Раз за сессию на версию лорбука. */
export async function canonEnsure() {
    if (!canonOn() || busy || !A?.hasChat?.()) return;
    const c = cfg();
    const { sig } = await timelineLore().catch(() => ({ sig: '' }));
    if (!sig || sig === tried) return;
    if (c.text && (c.hand || c.sig === sig)) return;
    try { await canonCollect(); } catch (e) { console.warn('[Life] канон', e); }
}

/** Для сверки Летописца: факты канона (или ''). */
export function canonText() { return canonOn() ? String(cfg().text || '').trim().slice(0, 2400) : ''; }

/** Для сверки Летописца: эпоха по году истории. */
export function eraLine() {
    if (!canonOn()) return '';
    let y = null;
    try { y = storyYear(); } catch { /* */ }
    if (!y) return '';
    const bits = [`год истории — ${y}`];
    if (y < 1960) bits.push('1940-е: нет мобильных, интернета, компьютеров, пластиковых карт, современного сленга; связь — телефон через станцию, телеграммы, письма, радио');
    bits.push(`что в мире случилось после ${y} — и по канону, и в реальности, — ещё НЕ произошло и как прошлое упоминаться не может`);
    return bits.join('; ');
}

// ───────────── настройки (внутри «Ляп-фикса») ─────────────

export function canonCfgHtml() {
    const c = cfg();
    const esc = (v) => A.esc(v);
    return `<label class="lf-switch"><input type="checkbox" data-act="cn-on" ${canonOn() ? 'checked' : ''}><span></span>Канон и эпоха: анахронизмы и расхождения с таймлайном — тем же ⚠</label>
    ${canonOn() ? `<div class="lf-field"><label>Канон этой истории — жёсткие факты${c.at ? ` <small>(${c.hand ? 'правлено руками' : 'собрано из лорбука'})</small>` : ''}</label>
        <textarea rows="7" data-in="cn-text" placeholder="• В истории сейчас такой-то год; что позже — ещё не случилось&#10;• Кто где был в какие годы, кто был мёртв или пропал — и когда…">${esc(c.text)}</textarea></div>
    <div class="lf-actions"><button class="lf-btn" data-act="cn-collect">${A.icon('book')} ${c.text ? 'Собрать заново из лорбука' : 'Собрать из лорбука'}</button></div>
    <div class="lf-hint">Из лорбука берутся записи про хронологию, даты, правила вселенной и «запрещённые ошибки». Эпоха — по дате истории: что ещё не случилось, того модель не может помнить.</div>` : ''}`;
}

export function canonInput(el) {
    if (el.dataset.in !== 'cn-text') return false;
    const c = cfg();
    c.text = String(el.value || '').slice(0, 4000);
    c.hand = true;
    A.saveSettings();
    return true;
}

export async function canonClick(act, el) {
    if (!act.startsWith('cn-')) return false;
    if (act === 'cn-on') { cfg().on = !!el.checked; A.saveSettings(); A.render?.(); return true; }
    if (act === 'cn-collect') {
        await A.withBusy(el, async () => {
            const n = await canonCollect();
            A.toast('success', `Выписала ${n} фактов канона`, '⚠ Канон', { timeOut: 2200 });
            A.render?.();
        }, 'Читаю лорбук…');
        return true;
    }
    return false;
}
