// Камни. Шкала энергии Камней в Хеди: спокойны (тихое тепло) / гудят (зуд под кожей, мигает свет, металл во рту) /
// приступ (жжёт изнутри, темнеет в глазах). Энергия живёт сама по времени истории: к норме за сутки, давление копится
// между приступами, стресс и сила разгоняют, покой и близость гасят. Перевалило — приступ: тебе сигнал сыграть,
// модели — что видно снаружи. Через ту же энергию она чувствует малыша. Приступы «боли от Камней» из травм — отсюда.

import { pregOf } from './zr.js';

let A = null;
export function initStones(api) { A = api; }

const esc = (v) => A.esc(v);
const H = 36e5;

function cfg() {
    const s = A.settings();
    if (!s.stones || typeof s.stones !== 'object') s.stones = {};
    const c = s.stones;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.base)) c.base = 28;
    if (!Number.isFinite(c.every)) c.every = 6;           // примерно раз в столько дней истории копится на приступ
    if (!c.who) {
        let names = [];
        try { names = [A.ctx().name1, ...A.groupMembers()].map(A.canonName).filter(Boolean); } catch { /* */ }
        const hedy = names.find(n => /^(хеди|hedy|ядвига)/i.test(n));
        if (hedy) { c.who = hedy; A.saveSettings(); }
    }
    return c;
}
export const stonesOn = () => cfg().on !== false && !!cfg().who;
export const stonesWho = () => cfg().who || '';

function M() {
    const cm = A.chatMeta();
    if (!cm.stones || typeof cm.stones !== 'object') cm.stones = {};
    const m = cm.stones;
    if (!Number.isFinite(m.lvl)) m.lvl = cfg().base;
    if (!Array.isArray(m.hist)) m.hist = [];
    return m;
}

export const STATE = (l) => (l >= 70 ? ['attack', 'приступ', 'жжёт изнутри, темнеет в глазах, дрожат руки'] : l >= 35 ? ['hum', 'гудят', 'зуд под кожей, рядом мигает свет, металлический привкус'] : ['calm', 'спокойны', 'тихое тепло под кожей']);

function storyT(i) {
    const chat = A.chatArr();
    for (let j = Math.min(i, chat.length - 1); j >= 0; j--) {
        const ts = chat[j]?.horae_meta?.timestamp;
        if (!ts?.story_date) continue;
        const d = A.parseDate(ts.story_date);
        if (!d || isNaN(d)) continue;
        const tm = String(ts.story_time || '').match(/(\d{1,2})[:.](\d{2})/);
        d.setHours(tm ? +tm[1] : 12, tm ? +tm[2] : 0, 0, 0);
        return d.getTime();
    }
    return null;
}

// детерминированный «случай»: свайп того же поста даёт то же
function rnd(seed) { let h = 2166136261; for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }

// ───────────── Летописец ─────────────

const RULE = `
stones — энергия Камней в {who} по ЭТОМУ посту: {"use":false,"stress":false,"calm":false,"attack":false}. use — она применила силу; stress — сильный страх, гнев, боль, опасность; calm — отдых, сон, его руки, тишина, близость её успокоили; attack — в посте уже идёт приступ боли от Камней.`;

export function stonesChron() {
    if (!A?.hasChat?.() || !stonesOn()) return null;
    const m = M();
    return { key: '"stones": {}', rule: RULE.replace('{who}', A.shortName(cfg().who)), tokens: 40, input: `Камни (${cfg().who}): ${STATE(m.lvl)[1]} ${Math.round(m.lvl)}/100` };
}

export function stonesAfterPost(i, j) {
    if (!stonesOn()) return;
    const m = M();
    // свайп того же поста — с того же места
    if (m.snap && m.snap.i === i) Object.assign(m, JSON.parse(m.snap.data));
    else m.snap = { i, data: JSON.stringify({ lvl: m.lvl, at: m.at, last: m.last || null, pend: m.pend || null, hist: m.hist }) };
    const t = storyT(i);
    const c = cfg();
    // приступ был сигналом на прошлый ход — она его сыграла, модель ответила: энергия выгорела
    if (m.pend && i > m.pend.mes + 1) {
        m.last = { at: m.pend.at ?? t, mes: i };
        const h = [...m.hist].reverse().find(x => x.kind === 'attack' && !x.played);
        if (h) h.played = true;
        m.pend = null;
        m.lvl = Math.min(m.lvl, 15);
    }
    // время: к норме за сутки; давление копится от прошлого приступа
    if (t != null && m.at != null && t > m.at) {
        const dh = (t - m.at) / H;
        m.lvl += (c.base - m.lvl) * (1 - Math.exp(-dh / 24));
        const days = m.last?.at != null ? (t - m.last.at) / (24 * H) : c.every / 2;
        const p = Math.min(0.5, (dh / 24) * Math.max(0, days / c.every) * 0.35);
        const calmNow = j?.stones?.calm === true || j?.stones?.calm === 'true';
        if (!calmNow && rnd(`${i}:${A.chatArr()[i]?.mes?.length}`) < p) { m.lvl += 38 + 14 * rnd(`s${i}`); m.hist.push({ at: t, mes: i, kind: 'surge', lvl: Math.round(m.lvl) }); }
    }
    if (t != null) m.at = t;
    const s = j?.stones && typeof j.stones === 'object' ? j.stones : {};
    const yes = (v) => v === true || v === 'true';
    if (yes(s.use)) m.lvl += 25;
    if (yes(s.stress)) m.lvl += 12;
    if (yes(s.calm)) m.lvl -= 15;
    if (yes(s.attack)) { m.last = { at: t, mes: i }; m.hist.push({ at: t, mes: i, kind: 'attack', lvl: Math.round(m.lvl), played: true }); m.lvl = 15; m.pend = null; }
    m.lvl = Math.max(0, Math.min(100, m.lvl));
    // перевалило за порог — приступ: сигнал ей и заметка модели на следующий ответ
    if (m.lvl >= 70 && !m.pend && !yes(s.attack)) {
        m.pend = { mes: i, at: t };
        m.hist.push({ at: t, mes: i, kind: 'attack', lvl: Math.round(m.lvl) });
        A.toast('warning', `${esc(A.shortName(c.who))}: Камни — приступ. Сыграй это в своём посте; персонажи заметят.<br><small>тапни — отменить</small>`, '⚡ Камни', {
            timeOut: 12000, escapeHtml: false,
            onclick: () => { const mm = M(); mm.pend = null; mm.lvl = 60; A.saveMeta(); A.updatePrompt(); A.render?.(); },
        });
    }
    if (m.hist.length > 60) m.hist.splice(0, m.hist.length - 60);
    A.saveMeta();
}

// ───────────── заметка ─────────────

export function stonesPrompt(type) {
    if (!A?.hasChat?.() || !stonesOn() || type === 'quiet' || type === 'impersonate') return '';
    const c = cfg();
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    if (here.length && !here.some(h => A.sameName(h, c.who))) return '';
    const m = M();
    const user = A.sameName(c.who, A.ctx().name1);
    const sh = A.shortName(c.who);
    if (m.pend) {
        return `[Камни: у ${sh} приступ боли от Камней — снаружи видно: бледнеет, дрожат руки, рядом мигает и трещит свет, пахнет озоном и металлом. ${user ? 'Её ощущения и как она это переносит — пишет она сама; персонажи замечают и реагируют по-своему.' : 'Сыграй по-настоящему.'}]`;
    }
    const [k, label, out] = STATE(m.lvl);
    let baby = '';
    try { const p = pregOf(c.who); if (p && p.ow >= 10 && m.lvl < 65) baby = ` Через энергию Камней она чувствует малыша — тёплый пульс в ответ${user ? ' (это её ощущение, расскажет сама)' : ''}.`; } catch { /* */ }
    if (k === 'calm' && !baby) return '';
    return `[Камни в ${sh}: ${label}${k !== 'calm' ? ` — снаружи бывает видно: ${out.split(', ').slice(1).join(', ') || out}` : ''}.${baby}]`;
}

// ───────────── вид ─────────────

export function stonesHtml(who) {
    if (!A?.hasChat?.() || !stonesOn() || !A.sameName(who, cfg().who)) return '';
    const m = M();
    const [k, label, out] = STATE(m.lvl);
    let baby = '';
    try { const p = pregOf(who); if (p && p.ow >= 10) baby = m.lvl < 65 ? 'малыш отзывается тёплым пульсом' : 'малыша сейчас не слышно за болью'; } catch { /* */ }
    const atts = m.hist.filter(h => h.kind === 'attack').slice(-4).reverse();
    return `${A.sec('Камни', label)}
    <div class="lf-stones s-${k}${m.pend ? ' pend' : ''}">
        <div class="lf-st-g"><i style="width:${Math.round(m.lvl)}%"></i><span style="left:35%"></span><span style="left:70%"></span></div>
        <div class="lf-st-t"><b>${m.pend ? 'Приступ — сыграй его' : esc(label)}</b><small>${esc(out)}${baby ? ` · ${esc(baby)}` : ''}</small></div>
        <div class="lf-st-b"><button data-act="kmn-calm">${A.icon('moon')} успокоить</button><button data-act="kmn-fire">${A.icon('zap')} приступ</button></div>
        ${atts.length ? `<div class="lf-st-h">${atts.map(a => `<span>${a.at ? esc(new Date(a.at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })) : `#${a.mes}`}${a.played ? '' : ' ⚡'}</span>`).join('')}</div>` : ''}
    </div>
    <div class="lf-hint">Энергия живёт сама по времени истории: к норме за сутки, давление копится между приступами (примерно раз в ${cfg().every} дн), сила и стресс разгоняют, покой гасит.</div>`;
}

export function stonesClick(act, el) {
    if (!act.startsWith('kmn-')) return false;
    const m = M();
    if (act === 'kmn-calm') { m.lvl = Math.max(0, m.lvl - 25); if (m.lvl < 70) m.pend = null; }
    if (act === 'kmn-fire') { m.lvl = 85; m.pend = { mes: A.chatArr().length - 1, at: m.at ?? null }; m.hist.push({ at: m.at ?? null, mes: m.pend.mes, kind: 'attack', lvl: 85 }); }
    A.saveMeta();
    A.updatePrompt();
    A.render();
    return true;
}

/** Приступы «боли от Камней» из травм теперь идут отсюда — кубик травм их не трогает. */
export function stonesOwns(who, w) {
    try { return stonesOn() && A.sameName(who, cfg().who) && /камн/i.test(String(w?.t || '')); } catch { return false; }
}

/** Для экрана: чьи Камни и что с ними сейчас — { who, lvl, mode: calm|hum|attack, pend }. */
export function stonesNow() {
    if (!A?.hasChat?.() || !stonesOn()) return null;
    const m = M();
    return { who: cfg().who, lvl: m.lvl, mode: m.pend ? 'attack' : STATE(m.lvl)[0], pend: !!m.pend };
}
