// Страховка чужих настроек, которые живут только в браузере (localStorage), а не на сервере.
// Fetish Manager держит всё в localStorage: обновление 1.4 → 1.6 переехало с ключа «fm» на «fm_v2»,
// а Safari на айфоне может вычистить данные сайта. Здесь:
//  1) из старого «fm» возвращаются свои фетиши (и выбор, если в новом пусто) — один раз;
//  2) копия «fm_v2» лежит в настройках Life на сервере и сама возвращается, если браузер её потерял.

const OLD = 'fm';
const NEW = 'fm_v2';
const DONE = 'life_fm_rescue_v1';
const NOTE = 'life_fm_rescue_note';

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/** Состояние для настроек Life: что лежит в браузере и на сервере. */
export function fmStatus(backup) {
    const old = read(OLD);
    const cur = read(NEW);
    const n = (x) => (Array.isArray(x?.custom) ? x.custom.length : 0);
    const curCustom = cur ? new Set([...(cur.template?.custom || []), ...Object.values(cur.profiles || {}).flatMap(p => p?.custom || [])].map(x => x?.id)) : new Set();
    return {
        old: old ? { custom: n(old), active: (old.active || []).length } : null,
        cur: cur ? { custom: curCustom.size, profiles: Object.keys(cur.profiles || {}).length, overrides: Object.keys(cur.overrides || {}).length } : null,
        backup: backup?.data ? { at: backup.at, custom: new Set([...(backup.data.template?.custom || []), ...Object.values(backup.data.profiles || {}).flatMap(p => p?.custom || [])].map(x => x?.id)).size } : null,
    };
}

/**
 * Вызывать как можно раньше. backup — { at, data } из настроек Life; save(data) — положить новую копию.
 * Возвращает строку для тоста или ''.
 */
export function fmRescue(backup, save) {
    const note = sessionStorage.getItem(NOTE);
    if (note) sessionStorage.removeItem(NOTE);
    let cur = read(NEW);
    let changed = false;
    const msgs = [];

    // браузер потерял настройки — вернуть копию с сервера
    if (!cur && backup?.data && typeof backup.data === 'object') {
        cur = JSON.parse(JSON.stringify(backup.data));
        changed = true;
        msgs.push('вернула настройки из копии на сервере');
    }

    // старые свои фетиши из 1.4
    const old = read(OLD);
    if (old && cur && !localStorage.getItem(DONE)) {
        const oldCustom = (Array.isArray(old.custom) ? old.custom : []).filter(x => x?.id && x?.prompt);
        const bags = [cur.template, ...Object.values(cur.profiles || {})].filter(Boolean);
        let added = 0;
        for (const b of bags) {
            if (!Array.isArray(b.custom)) b.custom = [];
            const have = new Set(b.custom.map(x => x?.id));
            for (const c of oldCustom) if (!have.has(c.id)) { b.custom.push(JSON.parse(JSON.stringify(c))); added++; }
            // выбор и силу — только туда, где пусто (не перебивать то, что она уже выставила в новой версии)
            if ((!Array.isArray(b.active) || !b.active.length) && Array.isArray(old.active) && old.active.length) {
                b.active = [...old.active];
                if (old.intensity) b.intensity = old.intensity;
                if (Number.isFinite(old.chance)) b.chance = old.chance;
                added++;
            }
        }
        localStorage.setItem(DONE, String(Date.now()));
        if (added) { changed = true; msgs.push(`вернула настройки из старой версии (своих фетишей: ${oldCustom.length})`); }
    }

    if (changed && cur && write(NEW, cur)) {
        // Fetish Manager уже прочитал старое — перезагрузить один раз, пока он ничего не сохранил поверх
        if (document.getElementById('fm-panel') && !sessionStorage.getItem('life_fm_reloaded')) {
            sessionStorage.setItem('life_fm_reloaded', '1');
            sessionStorage.setItem(NOTE, msgs.join('; '));
            setTimeout(() => location.reload(), 300);
            return '';
        }
    }
    sessionStorage.removeItem('life_fm_reloaded');
    // свежая копия на сервер
    const now = read(NEW);
    if (now && JSON.stringify(now) !== JSON.stringify(backup?.data || null)) save({ at: Date.now(), data: now });
    const out = [note, ...msgs].filter(Boolean).join('; ');
    return out;
}

/** Держать копию свежей: Fetish Manager пишет в localStorage сам, без событий. */
export function fmWatch(getBackup, save) {
    let last = localStorage.getItem(NEW) || '';
    setInterval(() => {
        const v = localStorage.getItem(NEW) || '';
        if (!v || v === last) return;
        last = v;
        try { save({ at: Date.now(), data: JSON.parse(v) }); } catch { /* битый json — пропустить */ }
    }, 20000);
}
