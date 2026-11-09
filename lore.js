// Записи лорбуков о персонаже: подключённые к чату, к карточкам и глобальные (как в «Привычках» и «Каноне»).
// Общая выборка для модулей, которым нужен лор о человеке (ядро характера, языки…).
// С ядром «Священный таймлайн» — только то, что видно из эпохи и даты этого чата (записи других лет, чужие тайны
// и куски записей «до/после» ядро отрезает само), облик людей на дату — из его Реестра, персона — с правками эпохи.

let A = null;
export function initLore(api) { A = api; }

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

// ───────────── ядро «Священный таймлайн» ─────────────

const core = () => globalThis.SacredTimeline || null;
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/** Записи книги, которые видно отсюда — по эпохе, дате сюжета и тому, кто что знает. Без ядра или вне мира — все. */
export async function eraVisible(entries, book) {
    const list = Array.isArray(entries) ? entries : Object.values(entries || {});
    const st = core();
    if (!st?.visible) return list;
    try { const v = await st.visible(list, book); return Array.isArray(v) ? v : list; } catch (e) { console.warn('[Life] ядро: записи эпохи', e); return list; }
}

/** Книги эпохи, которые ядро подключает само (их нет в настройках ST). */
export function eraBooks() {
    try { const cx = core()?.context?.(); return Array.isArray(cx?.era?.lore) ? cx.era.lore.filter(Boolean) : []; } catch { return []; }
}

let memo = { sig: '', at: 0, eraId: '', patches: [], looks: {} };
const recs = (data, type) => Object.values(data?.entries || {}).map(e => e?.gc).filter(g => g && g.type === type);

/** Облик людей чата на дату и правки персоны эпохи — из Реестра ядра. Раз в минуту или при смене эпохи/чата. */
export async function coreRefresh(force = false) {
    const st = core();
    let cx = null;
    try { cx = st?.context?.() || null; } catch { /* */ }
    if (!cx?.era || !st?.registry) { memo = { sig: '', at: Date.now(), eraId: '', patches: [], looks: {} }; return memo; }
    const sig = `${cx.world?.id || ''}|${cx.era.id}|${cx.chatId || ''}|${cx.date || ''}|${JSON.stringify(cx.people || {})}`;
    if (!force && memo.sig === sig && Date.now() - memo.at < 60000) return memo;
    let data = null;
    try { data = await st.registry(); } catch (e) { console.warn('[Life] ядро: Реестр', e); }
    const era = recs(data, 'era').find(e => String(e.id) === String(cx.era.id)) || null;
    const ids = recs(data, 'identity');
    const looks = {};
    for (const [name, p] of Object.entries(cx.people || {})) {
        const sl = (ids.find(g => g.id === p?.identity)?.slices || []).find(x => x.id === p?.slice);
        if (sl && (str(sl.look) || str(sl.label))) looks[name] = { look: str(sl.look), label: str(sl.label) };
    }
    memo = { sig, at: Date.now(), eraId: String(cx.era.id), patches: Array.isArray(era?.personaPatches) ? era.personaPatches : [], looks };
    return memo;
}

function memoNow() {
    try { const cx = core()?.context?.(); return cx?.era && String(cx.era.id) === memo.eraId ? memo : null; } catch { return null; }
}

/** Облик человека в эту эпоху по ядру (строка look его среза в Реестре) или ''. */
export function eraLook(name) {
    const m = memoNow();
    if (!m) return '';
    const hit = Object.entries(m.looks).find(([n]) => A.sameName(n, name));
    return hit ? hit[1].look : '';
}

/** Строки «как выглядят сейчас» для тех, кого назвали (или всех в чате) — чтобы модель не выдумывала внешность. */
export async function eraLookLines(names = null) {
    await coreRefresh().catch(() => null);
    const m = memoNow();
    if (!m) return [];
    const list = names || Object.keys(m.looks);
    const out = [];
    for (const n of list) { const l = eraLook(n); if (l && !out.some(x => x.startsWith(`${A.shortName(A.canonName(n))} —`))) out.push(`${A.shortName(A.canonName(n))} — ${l}`); }
    return out;
}

/** Текст персоны с правками эпохи (возраст, «сейчас», внешность) — как ядро правит её в промпте. */
export function personaNow(text) {
    let t = String(text || '');
    const m = memoNow();
    for (const p of m?.patches || []) if (p?.find && t.includes(p.find)) t = t.split(p.find).join(p.replace ?? '');
    return t;
}

/** Подключённые лорбуки (имена). */
export async function activeBooks(W = null) {
    W = W || await wiMod();
    if (!W?.loadWorldInfo) return { W: null, books: [] };
    const c = A.ctx();
    const books = new Set();
    if (c.chatMetadata?.world_info) books.add(c.chatMetadata.world_info);
    for (const ch of A.chatCards?.() || []) {
        if (ch?.data?.extensions?.world) books.add(ch.data.extensions.world);
        (W.world_info?.charLore || []).find(e => e.name === ch.avatar)?.extraBooks?.forEach(b => books.add(b));
    }
    (W.selected_world_info || []).forEach(b => books.add(b));
    eraBooks().forEach(b => books.add(b));
    try { const pl = c.powerUserSettings?.persona_description_lorebook; if (pl) books.add(pl); } catch { /* */ }
    return { W, books: [...books] };
}

/**
 * Лор о персонаже: записи, где он назван (в ключах, названии, фильтре персонажей или в начале текста),
 * подходящие под re (если задан). max — сколько символов всего. С ядром — только видное из этой эпохи (all — все).
 */
export async function loreFor(who, { re = null, max = 14000, all = false } = {}) {
    const { W, books } = await activeBooks();
    if (!W) return '';
    const first = A.norm(A.shortName(A.canonName(who)));
    const stem = first.slice(0, Math.max(3, first.length - 1));
    const out = [];
    let total = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        // all — сквозь все эпохи (таблица «кого как узнают по годам» общая на все чаты)
        for (const e of all ? Object.values(data?.entries || {}) : await eraVisible(data?.entries, b)) {
            const t = String(e?.content || '');
            if (e?.disable || !t.trim()) continue;
            const head = `${e.comment || ''} ${(e.key || []).join(' ')} ${(e.characterFilter?.names || []).join(' ')}`;
            if (re && !re.test(`${head} ${t.slice(0, 500)}`)) continue;
            if (!A.norm(`${head} ${t.slice(0, 1500)}`).includes(stem)) continue;
            const piece = `### ${e.comment || (e.key || []).join(', ')}\n${t.slice(0, 4000)}`;
            if (total + piece.length > max) break;
            out.push(piece);
            total += piece.length;
        }
    }
    return out.join('\n\n');
}

/** Карточка персонажа (описание и характер) или описание персоны игрока. */
export function cardText(who, max = 5000) {
    const c = A.ctx();
    if (A.sameName(who, c.name1)) return A.cut(personaNow(c.powerUserSettings?.persona_description || ''), max);
    const ch = A.cardOf?.(who);
    return A.cut([ch?.description, ch?.personality, ch?.data?.description, ch?.data?.personality].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join('\n'), max);
}
