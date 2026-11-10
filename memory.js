// Память Летописца: записи по постам в метаданных чата — «номер поста : вариант : хеш текста».
// Вынесено из index.js, чтобы проверять тестами: ключ поста с памятью, запись по тексту после съехавших номеров,
// бережная обрезка.

export function makeChronMemory({ chatArr, chatMeta, saveMeta, hash }) {
    // Ключ поста — вариант (свайп) и хеш текста. Хеш длинного поста дорог, а спрашивают его на каждый пересчёт
    // у сотен постов — помним, пока текст и вариант те же.
    const keyMemo = new WeakMap();
    function msgKey(m) {
        if (!m || typeof m !== 'object') return `0:${hash('')}`;
        const mes = m.mes || '', sw = m.swipe_id ?? 0;
        const c = keyMemo.get(m);
        if (c && c.mes === mes && c.sw === sw) return c.key;
        const key = `${sw}:${hash(mes)}`;
        keyMemo.set(m, { mes, sw, key });
        return key;
    }
    function chronStore() { const cm = chatMeta(); if (!cm.chron || typeof cm.chron !== 'object') cm.chron = {}; return cm.chron; }

    // Записи лежат под «номер поста : вариант : хеш». Удалили пост в середине чата — номера съехали, а текст тот же:
    // запись ищется по тексту и переезжает на новый номер (иначе всё, что Летописец помнил после удалённого, терялось).
    let sufMemo = { st: null, n: -1, map: null };
    function chronBySuffix(st) {
        const n = Object.keys(st).length;
        if (sufMemo.st === st && sufMemo.n === n && sufMemo.map) return sufMemo.map;
        const map = new Map();
        for (const k of Object.keys(st)) { const suf = k.slice(k.indexOf(':') + 1); if (!map.has(suf)) map.set(suf, []); map.get(suf).push(k); }
        sufMemo = { st, n, map };
        return map;
    }
    function chronOf(i) {
        const chat = chatArr();
        const m = chat[i];
        if (!m) return null;
        const st = chronStore();
        const suf = msgKey(m);
        const hit = st[`${i}:${suf}`];
        if (hit) return hit;
        if (m.is_user) return null;
        for (const k of chronBySuffix(st).get(suf) || []) {
            const j = parseInt(k, 10);
            if (j === i || !st[k]) continue;
            const other = chat[j];
            if (other && other !== m && msgKey(other) === suf) continue;   // там свой такой же пост — запись его
            st[`${i}:${suf}`] = st[k];
            delete st[k];
            sufMemo.st = null;
            saveMeta();
            return st[`${i}:${suf}`];
        }
        return null;
    }
    /** Сообщение поправили снаружи (Реплики подменили реплику) — запись Летописца переезжает на новый текст. */
    function rekeyChron(i, oldMes) {
        const m = chatArr()[i];
        if (!m || oldMes == null) return false;
        const st = chronStore();
        const oldK = `${i}:${m.swipe_id ?? 0}:${hash(oldMes)}`;
        const newK = `${i}:${msgKey(m)}`;
        if (oldK === newK || !st[oldK]) return false;
        if (!st[newK]) st[newK] = st[oldK];
        delete st[oldK];
        saveMeta();
        return true;
    }

    /**
     * Память Летописца не режется по числу записей (раньше — 500, и каждый реролл считался): у старых постов
     * пропадали детали и кадры, а с ними — что узнали о руке, тайнах, мизансцене. Теперь: сначала записи съехавших
     * постов возвращаются на место, потом уходят записи выброшенных рероллов (старше 30 постов), у давних — только
     * тяжёлое служебное (отмена правок вещей); совсем предел — 4000.
     */
    function trimChron() {
        const st = chronStore();
        if (Object.keys(st).length <= 600) return;
        const chat = chatArr();
        for (let i = 0; i < chat.length; i++) if (chat[i] && !chat[i].is_user) chronOf(i);
        const old = chat.length - 30;
        for (const k of Object.keys(st)) {
            const i = parseInt(k, 10);
            if (!(i < old)) continue;
            const m = chat[i];
            if (!m || k !== `${i}:${msgKey(m)}`) { delete st[k]; continue; }
            if (i < chat.length - 300) { delete st[k].undo; delete st[k].ops; }
        }
        const keys = Object.keys(st);
        if (keys.length > 4000) keys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).slice(0, keys.length - 4000).forEach(k => delete st[k]);
        sufMemo.st = null;
    }

    return { msgKey, chronStore, chronOf, rekeyChron, trimChron, forget: () => { sufMemo.st = null; } };
}
