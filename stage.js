// Мизансцена. Летописец после поста отмечает, кто где стоит, сидит или лежит на конец поста
// (у окна, на диване, в дверях) и рядом с кем. В Сцене — мини-план комнаты с фишками;
// модель получает «кто где сейчас», чтобы никто не телепортировался из угла в угол без шага.

let A = null;
export function initStage(api) { A = api; }

const esc = (v) => A.esc(v);
const POSES = { stand: 'стоит', sit: 'сидит', lie: 'лежит', lean: 'прислонясь', kneel: 'на коленях', walk: 'ходит', hold: 'на руках' };

function cfg() {
    const s = A.settings();
    if (!s.stage || typeof s.stage !== 'object') s.stage = {};
    const c = s.stage;
    if (c.on === undefined) c.on = true;
    return c;
}
export const stageOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.stage || typeof cm.stage !== 'object') cm.stage = {};
    const s = cm.stage;
    if (!s.places || typeof s.places !== 'object') s.places = {};
    if (!s.manual || typeof s.manual !== 'object') s.manual = {};
    return s;
}

/** Место поста i по Horae (на нём или раньше). */
function locAt(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) { const l = chat[j]?.horae_meta?.scene?.location; if (l) return l; }
    return '';
}

/** Кто где сейчас: { loc, key, at: { Имя: { at, pose, near, mes } } } — только в текущем месте. */
export function stageNow() {
    const chat = A.chatArr();
    const st = A.worldState();
    const loc = st.scene?.location || locAt(chat.length - 1);
    const key = A.placeKey(loc);
    const here = (st.scene?.characters_present || []).map(A.canonName);
    const out = {};
    for (let i = chat.length - 1; i >= 0 && i > chat.length - 60; i--) {
        const m = chat[i];
        if (!m) continue;
        if (m.extra?.life?.location) break;                 // смена сцены — дальше старое
        const e = A.chronOf(i);
        if (!e?.pos) continue;
        if (e.posLoc != null && e.posLoc !== key) break;    // пост в другом месте
        for (const [n, p] of Object.entries(e.pos)) {
            if (out[n] || (here.length && !here.some(h => A.sameName(h, n)))) continue;
            out[n] = { ...p, mes: i };
        }
    }
    for (const [n, p] of Object.entries(M().manual)) {
        if (p.key !== key) continue;
        if (here.length && !here.some(h => A.sameName(h, n))) continue;
        if (!out[n] || (p.mes ?? -1) >= (out[n].mes ?? -1)) out[n] = { ...p, own: true };
    }
    return { loc, key, at: out };
}

// ───────────── Летописец ─────────────

const RULE = `
pos — мизансцена на КОНЕЦ этого поста, для каждого, кто физически в сцене: {"Имя":{"at":"где именно, 1–4 слова: у окна / на диване / в дверях / за столом / у плиты","pose":"stand|sit|lie|lean|kneel|walk|hold","near":"рядом с кем — имя, или пусто"}}. По тексту поста; чьё место не менялось и не названо — повтори из «Мизансцены». Если пост в новом месте — заново. Кого нет в сцене — не пиши.`;

export function stageChron(i) {
    if (!A?.hasChat?.() || !stageOn()) return null;
    const s = stageNow();
    const rows = Object.entries(s.at).map(([n, p]) => `${n} — ${p.at}${POSES[p.pose] ? `, ${POSES[p.pose]}` : ''}${p.near ? `, рядом с ${p.near}` : ''}`);
    return { key: '"pos": {}', rule: RULE, tokens: 120, input: `Мизансцена до этого поста (${s.loc || 'место не записано'}): ${rows.length ? rows.join('; ') : 'не отмечена'}` };
}

const str = (v) => (typeof v === 'string' ? v.trim() : '');

export function stageAfterPost(i, j) {
    if (!stageOn()) return;
    const e = A.chronOf(i);
    if (!e || !j?.pos || typeof j.pos !== 'object' || Array.isArray(j.pos)) return;
    const pos = {};
    for (const [n, p] of Object.entries(j.pos)) {
        const at = str(p?.at).slice(0, 40);
        if (!n || !at) continue;
        pos[A.canonName(n)] = { at, pose: POSES[str(p.pose)] ? str(p.pose) : 'stand', near: str(p.near).slice(0, 40) };
    }
    if (!Object.keys(pos).length) return;
    e.pos = pos;
    e.posLoc = A.placeKey(locAt(i));
    // ручная правка уступает новому посту
    for (const [n] of Object.entries(pos)) { const mm = M().manual[n]; if (mm && (mm.mes ?? -1) < i) delete M().manual[n]; }
    A.saveMeta();
}

// ───────────── заметка ─────────────

export function stagePrompt(type) {
    if (!A?.hasChat?.() || !stageOn() || type === 'quiet' || type === 'impersonate') return '';
    const s = stageNow();
    const rows = Object.entries(s.at).map(([n, p]) => `${A.shortName(n)} — ${p.at}${POSES[p.pose] && p.pose !== 'stand' ? `, ${POSES[p.pose]}` : ''}${p.near ? `, рядом с ${A.shortName(A.canonName(p.near))}` : ''}`);
    if (!rows.length) return '';
    return `[Мизансцена сейчас: ${rows.join('; ')}. Двигаются только действием в тексте: никто не оказывается в другом месте комнаты (или в другой комнате) без шага, перехода или слов об этом.]`;
}

// ───────────── мини-план ─────────────

const ZONES = [
    [/двер|вход|порог|прихож|коридор/, [0.5, 0.9], 'door'],
    [/окн|подоконник|балкон|лоджи/, [0.5, 0.1], 'sun'],
    [/камин/, [0.24, 0.12], 'flame'],
    [/кроват|постел/, [0.72, 0.3], 'bed'],
    [/диван|софа|кушетк/, [0.28, 0.66], 'sofa'],
    [/кресл/, [0.14, 0.48], 'sofa'],
    [/стол|обеден/, [0.52, 0.47], 'utensils'],
    [/плит|раковин|мойк|холодильник|столешниц|кухн|кофемаш/, [0.12, 0.28], 'coffee'],
    [/бар\b|барн|стойк/, [0.2, 0.16], 'martini'],
    [/ванн|душ/, [0.86, 0.8], 'bath'],
    [/шкаф|гардероб|комод|полк|стеллаж/, [0.88, 0.52], 'box'],
    [/зеркал/, [0.88, 0.2], 'eye'],
    [/на полу|пол$|ковр|ковер/, [0.56, 0.72], 'layers'],
    [/стен/, [0.9, 0.66], 'blocks'],
    [/угл|угол/, [0.1, 0.88], 'triangle'],
    [/центр|середин/, [0.5, 0.58], 'target'],
    [/машин|авто|салон|сидень|руль/, [0.5, 0.5], 'car'],
];
const RING = [[0.32, 0.26], [0.7, 0.62], [0.36, 0.4], [0.72, 0.16], [0.4, 0.8], [0.64, 0.4], [0.22, 0.82], [0.8, 0.36], [0.5, 0.3], [0.3, 0.52]];

const spotKey = (at) => A.norm(at).replace(/^(у|на|в|во|за|возле|около|рядом с|под|над|перед|при|к|ко|по)\s+/, '').replace(/[^a-zа-я0-9 ]/gi, '').trim();

function layout(key, spots) {
    const mem = M().places[key] || (M().places[key] = { spots: {} });
    const used = Object.values(mem.spots).map(x => x.xy);
    const far = (xy) => used.every(u => Math.hypot(u[0] - xy[0], u[1] - xy[1]) > 0.11);
    const out = {};
    for (const at of spots) {
        const k = spotKey(at);
        if (!k) continue;
        if (mem.spots[k]) { out[k] = mem.spots[k]; continue; }
        const z = ZONES.find(([re]) => re.test(A.norm(at)));
        let xy = z ? [...z[1]] : null;
        if (xy && !far(xy)) {
            const same = Object.values(mem.spots).find(x => x.zone === z[2] && Math.hypot(x.xy[0] - xy[0], x.xy[1] - xy[1]) < 0.11);
            if (same) { out[k] = same; mem.spots[k] = same; continue; }
            for (const d of [[0.12, 0], [-0.12, 0], [0, 0.12], [0, -0.12], [0.16, 0.12], [-0.16, -0.12]]) { const t = [xy[0] + d[0], xy[1] + d[1]]; if (t[0] > 0.05 && t[0] < 0.95 && t[1] > 0.05 && t[1] < 0.95 && far(t)) { xy = t; break; } }
        }
        if (!xy) xy = RING.find(far) || [0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.6];
        const rec = { xy, icon: z?.[2] || 'pin', zone: z?.[2] || '', name: at };
        mem.spots[k] = rec;
        used.push(xy);
        out[k] = rec;
    }
    return out;
}

export function stageHtml() {
    if (!A?.hasChat?.() || !stageOn()) return '';
    const s = stageNow();
    const ppl = Object.entries(s.at);
    if (!ppl.length) return '';
    const spots = layout(s.key, ppl.map(([, p]) => p.at));
    A.saveMeta();
    const groups = new Map();
    for (const [n, p] of ppl) { const k = spotKey(p.at); if (!groups.has(k)) groups.set(k, []); groups.get(k).push([n, p]); }
    const tokens = [];
    for (const [k, list] of groups) {
        const sp = spots[k];
        if (!sp) continue;
        list.forEach(([n, p], idx) => {
            const dx = (idx - (list.length - 1) / 2) * 0.13;
            const x = Math.min(0.92, Math.max(0.08, sp.xy[0] + dx));
            const y = Math.min(0.9, Math.max(0.1, sp.xy[1] + 0.02));
            tokens.push(`<button class="lf-st-tok pose-${p.pose}${p.own ? ' own' : ''}" style="left:${(x * 100).toFixed(1)}%;top:${(y * 100).toFixed(1)}%" data-act="st-edit" data-name="${esc(n)}">${A.ava(n, 'sm')}<span>${esc(A.shortName(n))}</span><small>${esc(POSES[p.pose] || '')}</small></button>`);
        });
    }
    const marks = [...new Set([...groups.keys()])].map(k => spots[k]).filter(Boolean)
        .map(sp => `<span class="lf-st-spot" style="left:${(sp.xy[0] * 100).toFixed(1)}%;top:${(sp.xy[1] * 100 - 9).toFixed(1)}%">${A.icon(sp.icon || 'pin')}${esc(A.cut(sp.name, 18))}</span>`).join('');
    return `${A.sec('Мизансцена', A.locLeaf(s.loc) || 'сейчас')}
    <div class="lf-stage"><div class="lf-st-room"><i class="lf-st-door"></i><i class="lf-st-win"></i>${marks}${tokens.join('')}</div></div>
    <div class="lf-hint">Кто где — на конец последнего поста; модель видит это и не телепортирует. Тап по фишке — поправить.</div>`;
}

export async function stageClick(act, el) {
    if (!act.startsWith('st-')) return false;
    const s = stageNow();
    switch (act) {
        case 'st-edit': {
            const n = el.dataset.name;
            const p = s.at[n] || {};
            A.openSheet(`${A.icon('pin')} ${esc(A.shortName(n))} — где`, `
                <div class="lf-field"><label>Где именно</label><input type="text" data-in="st-at" value="${esc(p.at || '')}" placeholder="у окна, на диване, в дверях"></div>
                <div class="lf-field"><label>Как</label><div class="lf-seg many">${Object.entries(POSES).map(([k, l]) => `<button class="${(p.pose || 'stand') === k ? 'on' : ''}" data-act="st-pose" data-v="${k}">${l}</button>`).join('')}</div></div>
                <button class="lf-btn primary full" data-act="st-save" data-name="${esc(n)}">Сохранить</button>`);
            return true;
        }
        case 'st-pose': el.parentElement?.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); return true;
        case 'st-save': {
            const box = el.closest('.lf-sheet') || document;
            const at = box.querySelector('[data-in="st-at"]')?.value?.trim();
            const pose = box.querySelector('[data-act="st-pose"].on')?.dataset.v || 'stand';
            if (!at) return true;
            M().manual[el.dataset.name] = { at: at.slice(0, 40), pose, near: '', key: s.key, mes: A.chatArr().length - 1 };
            A.saveMeta();
            A.updatePrompt();
            A.closeSheet();
            A.render();
            return true;
        }
    }
    return false;
}

/** Для «Кто где» и других: где и как человек в сцене сейчас. */
export function stageOf(name) { const s = stageNow(); const k = Object.keys(s.at).find(n => A.sameName(n, name)); return k ? { ...s.at[k], pose: POSES[s.at[k].pose] || '' } : null; }
