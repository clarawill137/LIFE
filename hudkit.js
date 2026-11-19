// Общие мелочи модулей «HUD-волны» (бой, дуэль, пари, под словами, близость, дневник, назревает, фракции, архив).
// Идеи этих модулей — из TavernOS HUD (alewwi, https://github.com/alewwi/HUD, AGPL-3.0), см. NOTICE-HUD.md;
// код написан заново под Life: данные ведёт Летописец после поста, а не основная модель в самом посте.

/** Сейчас по истории (мс) из Horae или null, если даты нет. */
export function storyNow(A) {
    const ts = A.worldState()?.timestamp || {};
    const d = A.parseDate(ts.story_date);
    if (!d || isNaN(d)) return null;
    const m = String(ts.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
    d.setHours(m ? +m[1] : 12, m ? +m[2] : 0, 0, 0);
    return d.getTime();
}

/** День истории строкой, как пишет Horae (или ''). */
export const storyDay = (A) => String(A.worldState()?.timestamp?.story_date || '').trim();

/** «2 ч 40 мин», «3 дн.» */
export function span(ms) {
    const min = Math.max(0, Math.round(ms / 60000));
    if (min < 60) return `${min} мин`;
    if (min < 48 * 60) { const h = Math.floor(min / 60), r = min % 60; return r ? `${h} ч ${r} мин` : `${h} ч`; }
    return `${Math.round(min / 1440)} дн.`;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : a));
export const str = (v, n = 200) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
export const arr = (v) => (Array.isArray(v) ? v : []);
export const clone = (v) => { try { return JSON.parse(JSON.stringify(v ?? null)); } catch { return null; } };

/** Похожи ли две короткие формулировки (по корням слов). */
export function similar(A, a, b, min = 0.6) {
    const flat = (t) => A.norm(t).replace(/[^a-zа-я0-9 ]/gi, '').split(' ').filter(w => w.length > 3).map(w => w.slice(0, 5));
    const x = new Set(flat(a)), y = flat(b);
    return !!x.size && !!y.length && y.filter(w => x.has(w)).length / Math.min(x.size, y.length) >= min;
}

/** Главные этого чата без персоны игрока. */
export function mains(A) {
    const user = A.canonName(A.ctx().name1);
    return A.groupMembers().map(A.canonName).filter(n => n && !A.sameName(n, user));
}

/** Кто сейчас в сцене (канонические имена). */
export const present = (A) => (A.worldState()?.scene?.characters_present || []).map(A.canonName).filter(Boolean);

/** Вставить плашку под пост (обновляет только если изменилась). */
export function mount(el, cls, html, hash) {
    const old = el.querySelector(`:scope .${cls}`);
    if (!html) { old?.remove(); return; }
    const sig = hash(html);
    if (old && old.dataset.sig === sig) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    if (!node) { old?.remove(); return; }
    node.dataset.sig = sig;
    if (old) old.replaceWith(node); else (el.querySelector('.mes_block') || el).append(node);
}

/** Момент истории: время Horae (мс или null), индекс последнего поста и день. */
export function clock(A) {
    const chat = A.chatArr();
    return { ts: storyNow(A), mes: chat.length - 1, day: storyDay(A) };
}

/** Сколько часов истории между двумя моментами; без дат — по постам (~15 минут на ответ). */
export function hoursBetween(A, a, b = clock(A)) {
    if (!a) return 0;
    if (a.ts != null && b.ts != null) return Math.max(0, (b.ts - a.ts) / 3.6e6);
    const chat = A.chatArr();
    let n = 0;
    for (let i = Math.max(0, (a.mes ?? b.mes) + 1); i <= b.mes && i < chat.length; i++) if (chat[i] && !chat[i].is_user && !chat[i].is_system) n++;
    return n * 0.25;
}

/** Хвост её поста прямо перед ответом i (для Летописца: перепалки и дела по дому) — один раз на проход Летописца. */
let tailMark = { i: -1, t: 0 };
export function herPostTail(A, i, max = 2200) {
    const chat = A.chatArr();
    const m = chat[i - 1];
    if (!m || !m.is_user) return '';
    if (tailMark.i === i && Date.now() - tailMark.t < 4000) return '';
    tailMark = { i, t: Date.now() };
    const t = A.plainText(m.mes || '');
    if (t.length <= 700) return '';   // короткий — Летописец и так видит его целиком
    return `Её пост перед этим ответом — конец (для быта и перепалок):\n…${t.slice(-max)}`;
}

/** Сцена у них дома? home — место дома (Life → Жизнь), loc — место сцены по Horae. */
const DWELL = /квартир|(?<![а-яёa-z0-9])дом(?![а-яёa-z0-9])|апартамент|пентхаус|лофт|спальн|кухн|гостин|ванн/i;
const NOT_HOME = /отел|гостиниц|мотел|хостел|кафе|ресторан|бар(?![а-яё])|офис|штаб|башн|больниц|клиник|лаборатор|база|бункер/i;
export function atHome(A, home) {
    const loc = String(A.worldState()?.scene?.location || '');
    if (!loc) return false;
    const top = (x) => A.norm(A.locTop ? A.locTop(x) : x).replace(/[«»"'.]/g, '').trim();
    if (home) { const a = top(loc), b = top(home); if (a && b && (a === b || a.startsWith(b) || b.startsWith(a))) return true; }
    return DWELL.test(top(loc)) && !NOT_HOME.test(loc);
}
