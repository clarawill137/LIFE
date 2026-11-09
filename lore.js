// Записи лорбуков о персонаже: подключённые к чату, к карточкам и глобальные (как в «Привычках» и «Каноне»).
// Общая выборка для модулей, которым нужен лор о человеке (ядро характера, языки…).

let A = null;
export function initLore(api) { A = api; }

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

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
    try { const pl = c.powerUserSettings?.persona_description_lorebook; if (pl) books.add(pl); } catch { /* */ }
    return { W, books: [...books] };
}

/**
 * Лор о персонаже: записи, где он назван (в ключах, названии, фильтре персонажей или в начале текста),
 * подходящие под re (если задан). max — сколько символов всего.
 */
export async function loreFor(who, { re = null, max = 14000 } = {}) {
    const { W, books } = await activeBooks();
    if (!W) return '';
    const first = A.norm(A.shortName(A.canonName(who)));
    const stem = first.slice(0, Math.max(3, first.length - 1));
    const out = [];
    let total = 0;
    for (const b of books) {
        let data = null;
        try { data = await W.loadWorldInfo(b); } catch { continue; }
        for (const e of Object.values(data?.entries || {})) {
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
    if (A.sameName(who, c.name1)) return A.cut(String(c.powerUserSettings?.persona_description || ''), max);
    const ch = A.cardOf?.(who);
    return A.cut([ch?.description, ch?.personality, ch?.data?.description, ch?.data?.personality].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join('\n'), max);
}
