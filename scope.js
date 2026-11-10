// Life — эпохи. Люди, места и районы лежат в общих настройках, а чатов много и они из разных лет (ядро
// «Священный таймлайн»): чтобы в сороковых не всплывали лавка и клиника из 2024-го, у каждой записи — список
// эпох, где она есть. Без списка — запись «ничья» и видна везде (как раньше). Список только растёт: запись
// получает эпоху чата, как только в нём появляется; уже видимое никогда не прячется.

/** Эпоха этого чата по ядру ('' — ядра нет или чат вне мира). */
export function eraId() { try { return String(globalThis.SacredTimeline?.context?.()?.era?.id || ''); } catch { return ''; } }
/** Видна ли запись в этой эпохе. */
export function inEra(x) { const e = eraId(); return !e || !Array.isArray(x?.eras) || !x.eras.length || x.eras.includes(e); }
/** Запись появилась в этом чате — приписать ей его эпоху. true — если приписала. */
export function addEra(x) {
    const e = eraId();
    if (!e || !x || typeof x !== 'object') return false;
    if (!Array.isArray(x.eras)) x.eras = [];
    if (x.eras.includes(e)) return false;
    x.eras.push(e);
    return true;
}
