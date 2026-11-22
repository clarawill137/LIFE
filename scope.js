// Life — эпохи. Люди, места, районы и правила лежат в общих настройках, а чатов много и они из разных лет (ядро
// «Священный таймлайн»): чтобы в сороковых не всплывали лавка и клиника из 2024-го, у каждой записи — список
// эпох, где она есть. Список только растёт: запись получает эпоху чата, как только в нём появляется.
// Без списка: запись основной ролки (заведена до эпох, 7.11.2026, или без даты) — видна только в эпохе мира по
// умолчанию (её решение 22.11: «ничьи» записи — 2024); новая без списка (сделана вне эпох) — везде. «*» — везде явно
// (правило «везде»). Без ядра и вне мира — видно всё.

/** Начало эпох: до этого всё было одной ролкой — эпохой мира по умолчанию. */
export const EPOCHS = Date.parse('2026-11-07T00:00:00Z');
/** Эпоха этого чата по ядру ('' — ядра нет или чат вне мира). */
export function eraId() { try { return String(globalThis.SacredTimeline?.context?.()?.era?.id || ''); } catch { return ''; } }
/** Эпоха мира по умолчанию — основная ролка ('' — ядра нет). */
export function defaultEra() { try { return String(globalThis.SacredTimeline?.context?.()?.world?.defaultEra || ''); } catch { return ''; } }
/** Запись основной ролки: без списка эпох и заведена до эпох (или без даты). */
export function legacyOf(x) {
    if (!x || (Array.isArray(x.eras) && x.eras.length)) return false;
    const t = Number(x.at) || 0;
    return !t || t < EPOCHS;
}
/** Видна ли запись в этой эпохе. Записи нет — прятать нечего. */
export function inEra(x) {
    const e = eraId();
    if (!e || !x) return true;
    const list = Array.isArray(x.eras) ? x.eras : [];
    if (list.includes('*')) return true;
    if (list.length) return list.includes(e);
    if (!legacyOf(x)) return true;
    const d = defaultEra();
    return !d || d === e;
}
/** Запись появилась в этом чате — приписать ей его эпоху. true — если приписала. */
export function addEra(x) {
    const e = eraId();
    if (!e || !x || typeof x !== 'object') return false;
    if (!Array.isArray(x.eras)) x.eras = [];
    if (x.eras.includes(e) || x.eras.includes('*')) return false;
    // старая запись впервые в другой эпохе — основная ролка за ней остаётся
    if (!x.eras.length && legacyOf(x)) { const d = defaultEra(); if (d && d !== e) x.eras.push(d); }
    x.eras.push(e);
    return true;
}
/** Подпись эпох записи: «везде», «1943, 2024», «2024 (до эпох)» или ''. */
export function erasText(x) {
    const list = Array.isArray(x?.eras) ? x.eras.filter(Boolean) : [];
    if (list.includes('*')) return 'везде';
    if (list.length) return list.join(', ');
    const d = legacyOf(x) ? defaultEra() : '';
    return d ? `${d} (до эпох)` : '';
}
