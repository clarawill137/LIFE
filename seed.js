// Life — посев «от Claude»: лорбук «Life — от Claude» (живёт только на сервере — приезжает мостом вместе
// с остальными лорбуками; в промпт не попадает: записи выключены, ключей нет). В каждой записи — JSON:
//   { "chat": "имя чата", "restoreDates": "smart" | "all",
//     "days": { "ГГГГ-ММ-ДД": { "text": "что было", "open": ["что осталось открытым"] } } }
//   { "feats": { "{{user}}" | "имя": [{ "year": 2014, "t": "что сделал(а)", "public": "как видели люди" }] } }
// Каждая запись применяется один раз (на свою версию текста): что потом поправлено руками — не перезаписывается.

import { restoreDates, setDaySummary } from './days.js';
import { setFeats } from './hero.js';

let A = null;
export function initSeed(api) { A = api; }

export const SEED_BOOK = 'Life — от Claude';

async function wiMod() { try { return await import('/scripts/world-info.js'); } catch { return null; } }

/** Записи посева: [{ id, p }] — p разобран из JSON; битые и пустые — мимо. */
async function seedEntries() {
    const W = await wiMod();
    if (!W?.loadWorldInfo) return [];
    let data = null;
    try { data = await W.loadWorldInfo(SEED_BOOK); } catch { return []; }
    const out = [];
    for (const e of Object.values(data?.entries || {})) {
        const t = String(e?.content || '').trim();
        if (!t.startsWith('{')) continue;
        let p = null;
        try { p = JSON.parse(t); } catch { console.warn(`[Life] посев: запись «${e?.comment || e?.uid}» — не JSON`); continue; }
        if (p && typeof p === 'object') out.push({ id: `${e?.uid ?? ''}:${A.hash(t)}`, p, what: String(e?.comment || '') });
    }
    return out;
}

const who = (n) => (/^\{\{user\}\}$/i.test(String(n).trim()) ? A.ctx().name1 : String(n || '').trim());

let running = false;
/** Применить посев к этому чату (и общее — подвиги). Вернёт, что сделано, или null. */
export async function seedApply() {
    if (running || !A?.hasChat?.()) return null;
    running = true;
    try {
        const list = await seedEntries();
        if (!list.length) return null;
        const s = A.settings();
        const cm = A.chatMeta();
        const doneG = new Set(Array.isArray(s.seedDone) ? s.seedDone : []);
        const doneC = new Set(Array.isArray(cm.seedDone) ? cm.seedDone : []);
        const chatId = String(A.ctx().chatId || A.ctx().getCurrentChatId?.() || '');
        const res = { days: 0, feats: 0, dates: 0 };
        for (const { id, p } of list) {
            // общее (не к чату) — подвиги
            if (p.feats && typeof p.feats === 'object' && !doneG.has(id)) {
                for (const [n, feats] of Object.entries(p.feats)) {
                    if (!Array.isArray(feats) || !who(n)) continue;
                    setFeats(who(n), feats);
                    res.feats++;
                }
                doneG.add(id);
            }
            // к чату — дни и даты; чужой чат — подождёт, пока откроешь свой
            if (!(p.chat || p.days || p.restoreDates) || doneC.has(id)) continue;
            if (p.chat && A.norm(p.chat) !== A.norm(chatId)) continue;
            if (p.restoreDates) {
                try { const r = await restoreDates({ smart: p.restoreDates !== 'all' }); res.dates += r.restored || 0; }
                catch (e) { console.warn('[Life] посев: даты', e); }
            }
            for (const [key, v] of Object.entries(p.days && typeof p.days === 'object' ? p.days : {})) {
                const text = String(typeof v === 'string' ? v : v?.text || '').trim();
                if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !text) continue;
                setDaySummary(key, text, Array.isArray(v?.open) ? v.open : []);
                res.days++;
            }
            doneC.add(id);
        }
        cm.seedDone = [...doneC].slice(-50);
        s.seedDone = [...doneG].slice(-50);
        A.saveMeta();
        A.saveSettings();
        if (!res.days && !res.feats && !res.dates) return null;
        A.toast('success', [res.dates ? `вернула даты Horae: ${res.dates}` : '', res.days ? `дни: ${res.days}` : '', res.feats ? `подвиги: ${res.feats}` : ''].filter(Boolean).join(' · '), '✦ Life — от Claude', { timeOut: 6000 });
        A.updatePrompt?.();
        A.render?.();
        return res;
    } catch (e) {
        console.warn('[Life] посев', e);
        return null;
    } finally { running = false; }
}
