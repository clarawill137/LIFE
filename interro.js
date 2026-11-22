// Допросная — рядом со «Словесной дуэлью»: допрос с полиграфом. Кто кого, что хотят узнать (из тайн, которые он
// держит, — «Кто что знает»), подход на каждый раунд: давление, лесть, сделка, логика, угроза, тишина. Кубик против
// выучки (Красная комната, Зимний солдат, ГИДРА); стресс копится, пульс и «тики» видны на полиграфе. Сколько выдал
// по каждому пункту — модель знает. В обе стороны: «допрашивают её» — под «Хеди в Гидре».

import { str, arr } from './hudkit.js';
import { knowKept } from './know.js';

let A = null;
export function initInterro(api) { A = api; }
const esc = (v) => A.esc(v);
const sn = (n) => A.shortName(n);
const d20 = () => 1 + Math.floor(Math.random() * 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const HOW = [
    ['press', 'Давление', 16, 0], ['flatter', 'Лесть', 6, 1], ['deal', 'Сделка', 8, 2], ['logic', 'Логика', 9, 1], ['threat', 'Угроза', 20, -1], ['silence', 'Тишина', 10, 1],
];
/** Выучка — чем держится: по имени и лору. */
export function resistOf(name) {
    const n = String(name || '');
    if (/баки|bucky|барнс|barnes|зимн/i.test(n)) return 6;
    if (/наташ|романов|natasha|елена|yelena|белов/i.test(n)) return 6;
    if (/хеди|hedy/i.test(n)) return 5;
    if (/рамлоу|rumlow|пирс|pierce|земо|zemo|гидр/i.test(n)) return 4;
    if (/фьюри|fury|роджерс|steve|стив|сэм|sam/i.test(n)) return 4;
    return 1;
}
/** Мастерство допрашивающего. */
export function skillOf(name) {
    const n = String(name || '');
    if (/наташ|романов|natasha/i.test(n)) return 6;
    if (/баки|bucky|барнс/i.test(n)) return 4;
    if (/фьюри|fury|пирс|pierce|рамлоу/i.test(n)) return 4;
    if (/хеди|hedy/i.test(n)) return 3;
    return 1;
}
const on = () => A.settings().interro?.on !== false;
function M() {
    const cm = A.chatMeta();
    if (!cm.iq || typeof cm.iq !== 'object') cm.iq = {};
    const s = cm.iq;
    if (!Array.isArray(s.past)) s.past = [];
    return s;
}
const cur = () => M().cur || null;

export function start({ side = 'we', subject = '', asker = '', goals = [] } = {}) {
    subject = A.canonName(str(subject, 60)); asker = A.canonName(str(asker, 60));
    if (!subject || !asker) return null;
    const g = arr(goals).map(t => str(t, 160)).filter(Boolean).slice(0, 5);
    M().cur = { side, subject, asker, goals: (g.length ? g : ['что он скрывает']).map(t => ({ t, got: 0 })), stress: 10, rounds: [], st: 'on', mes: A.chatArr().length - 1 };
    A.saveMeta();
    return M().cur;
}
// строки — «мужской|женский»
const OUT = [
    [5, 'shut', ['замкнулся|замкнулась: смотрит сквозь стену', 'улыбается и молчит — выучка', 'отвечает заученной легендой']],
    [10, 'tic', ['держится, но выдал|выдала тик: дёрнулся уголок рта', 'голос ровный, а пальцы постукивают', 'взгляд ушёл влево — и вернулся']],
    [15, 'bit', ['проговорился|проговорилась — кусок правды', 'поправил|поправила себя, но поздно', 'выдал|выдала деталь, которую не должен|должна был|была знать']],
    [19, 'lot', ['поплыл|поплыла: говорит больше, чем хотел|хотела', 'сломался|сломалась на половине фразы — и договорил|договорила']],
    [99, 'broke', ['раскололся|раскололась']],
];
const FEM = /хеди|hedy|наташ|natasha|елен|yelena|пеппер|pepper|шури|shuri|ванд|wanda|джулия|мария|кейт|шэрон|sharon|пегги|peggy/i;
export const femOf = (n) => FEM.test(String(n || '')) || (/[ая]$/i.test(String(n || '').split(' ')[0]) && !/^(илья|никита|фома|лука|кузьма)$/i.test(String(n || '').split(' ')[0]));
const g = (t, f) => t.replace(/([а-яё]+)\|([а-яё]+)/gi, (m, a, b) => (f ? b : a));
/** Раунд: подход → кубик + мастерство + стресс против выучки. */
export function round(how) {
    const c = cur();
    if (!c || c.st !== 'on') return null;
    const h = HOW.find(x => x[0] === how) || HOW[0];
    const r = d20();
    const mod = skillOf(c.asker) + Math.floor(c.stress / 25) + h[3] - resistOf(c.subject);
    // натуральная 20 раскалывает только уже «поплывшего»; выучку так просто не взять
    const tot = r === 20 ? (c.stress >= 60 ? 99 : Math.min(19, r + mod + 6)) : Math.min(19, r + mod);
    const [, kind, lines] = OUT.find(([lim]) => tot <= lim) || OUT[OUT.length - 1];
    c.stress = clamp(c.stress + h[2] + (kind === 'shut' ? -4 : 0), 0, 100);
    const goal = c.goals.filter(g => g.got < 100).sort((a, b) => b.got - a.got)[0] || c.goals[0];
    const gain = { shut: 0, tic: 5, bit: 25, lot: 45, broke: 100 }[kind];
    if (goal && gain) goal.got = clamp(goal.got + gain, 0, 100);
    if (kind === 'broke' || c.goals.every(g => g.got >= 100)) c.st = 'broken';
    const line = `${h[1]}: ${sn(c.subject)} ${g(lines[Math.floor(Math.random() * lines.length)], femOf(c.subject))}${goal && gain ? ` — про «${goal.t}»` : ''}.`;
    c.rounds.push({ how: h[0], r, mod, tot: Math.min(tot, 99), kind, line });
    A.saveMeta();
    return c.rounds[c.rounds.length - 1];
}
export function stop(st = 'held') {
    const s = M();
    const c = s.cur;
    if (!c) return;
    c.st = c.st === 'broken' ? 'broken' : st;
    s.past = [{ ...c, end: A.chatArr().length - 1 }, ...s.past].slice(0, 10);
    s.cur = null;
    A.saveMeta();
}
const pulse = (c) => Math.round(68 + c.stress * 0.9 + (c.rounds.at(-1)?.kind === 'tic' ? 12 : 0));
const tells = (c) => [c.stress > 25 && 'пот на висках', c.stress > 45 && 'сухо во рту — глотает', c.stress > 60 && 'руки не находят места', c.stress > 80 && 'голос срывается', c.rounds.at(-1)?.kind === 'tic' && 'тик'].filter(Boolean);
const gotWord = (v) => (v >= 100 ? 'всё' : v >= 60 ? 'много' : v >= 25 ? 'кусок' : v > 0 ? 'крохи' : 'ничего');

export function iqPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const c = cur();
    if (!c) return '';
    const last = c.rounds.at(-1);
    const her = c.side === 'her';
    return `[Допросная: ${sn(c.asker)} допрашивает ${sn(c.subject)}${last ? `, подход — ${HOW.find(x => x[0] === last.how)?.[1].toLowerCase()}` : ''}. Полиграф: пульс ~${pulse(c)}${tells(c).length ? `; видно: ${tells(c).join(', ')}` : ''}. ${her ? 'Она выдала' : 'Выдал'}: ${c.goals.map(g => `«${g.t}» — ${gotWord(g.got)}`).join('; ')}.${last ? ` Сейчас: ${last.line}` : ''}${c.st === 'broken' ? ` ${femOf(c.subject) ? 'Раскололась' : 'Раскололся'} — говорит.` : ''} Играй это телом и словами; цифр и кубиков не называй.]`;
}

// ───────────── экран ─────────────

const ui = { side: 'we', goals: [] };
function polySvg(c) {
    const W = 320, H = 96;
    const lines = [['#ff7b8a', 1, 0], ['#7bdff2', 0.6, 2], ['#ffd166', 0.4, 4]];
    const spikes = c.rounds.slice(-6).map(r => (r.kind === 'tic' ? 1 : r.kind === 'bit' || r.kind === 'lot' ? 0.7 : r.kind === 'broke' ? 1.2 : 0.2));
    const amp = 6 + c.stress * 0.22;
    let out = `<svg class="lf-iq-poly" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><g class="grid">${[24, 48, 72].map(y => `<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`).join('')}</g>`;
    lines.forEach(([col, k, ph], li) => {
        let d = '';
        for (let x = 0; x <= W; x += 4) {
            const seg = Math.floor(x / (W / Math.max(1, spikes.length)));
            const sp = spikes[Math.min(seg, spikes.length - 1)] || 0.2;
            const y = 18 + li * 28 + Math.sin((x + ph * 13) / (7 - li)) * amp * k * (0.5 + sp) + (sp > 0.9 && x % 40 < 8 ? -amp * 0.8 : 0);
            d += `${x ? 'L' : 'M'}${x} ${clamp(y, 2, H - 2).toFixed(1)}`;
        }
        out += `<path d="${d}" stroke="${col}" fill="none" stroke-width="1.4"/>`;
    });
    return `${out}</svg>`;
}
function peopleNames() {
    const out = [];
    const add = (n) => { n = A.canonName(n); if (n && !out.some(x => A.sameName(x, n))) out.push(n); };
    add(A.ctx().name1);
    try { (A.groupMembers?.() || []).forEach(add); } catch { /* */ }
    try { (A.worldState()?.scene?.characters_present || []).forEach(add); } catch { /* */ }
    return out.slice(0, 10);
}
export function iqSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const c = cur();
    const s = M();
    if (!c) {
        const ppl = peopleNames();
        return `${A.sec('Допросная')}
            <div class="lf-chips wrap"><button class="lf-chip${ui.side === 'we' ? ' on' : ''}" data-act="iq-side" data-v="we">Допрашиваем мы</button><button class="lf-chip${ui.side === 'her' ? ' on' : ''}" data-act="iq-side" data-v="her">Допрашивают её</button></div>
            <div class="lf-field"><label>Кого допрашивают</label><input data-iqf="subject" list="lf-iq-ppl" value="${ui.side === 'her' ? esc(A.canonName(A.ctx().name1)) : ''}" placeholder="Рамлоу"></div>
            <div class="lf-field"><label>Кто допрашивает</label><input data-iqf="asker" list="lf-iq-ppl" value="${ui.side === 'we' ? esc(A.canonName(A.ctx().name1)) : ''}" placeholder="Пирс"></div>
            <datalist id="lf-iq-ppl">${ppl.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
            <div class="lf-field"><label>Что хотят узнать (по строке)</label><textarea data-iqf="goals" rows="3" placeholder="где держат Земо\nкто слил адрес">${esc(ui.goals.join('\n'))}</textarea></div>
            <div class="lf-actions"><button class="lf-btn" data-act="iq-kept">🔒 Из его тайн</button><button class="lf-btn primary" data-act="iq-start">Начать допрос</button></div>
            ${s.past.length ? `${A.sec('Было')}${s.past.slice(0, 4).map(p => `<div class="lf-iq-past"><b>${esc(sn(p.asker))} → ${esc(sn(p.subject))}</b><small>${esc(p.goals.map(x => `${x.t}: ${gotWord(x.got)}`).join(' · '))}${p.st === 'broken' ? (femOf(p.subject) ? ' · раскололась' : ' · раскололся') : ''}</small></div>`).join('')}` : ''}
            <div class="lf-hint">Выучка решает: Красную комнату и Зимнего солдата так просто не расколешь. Стресс копится от раунда к раунду.</div>`;
    }
    const her = c.side === 'her';
    const last = c.rounds.at(-1);
    return `${A.sec('Допросная', her ? 'допрашивают её' : 'допрос')}
        <div class="lf-iq-who"><b>${esc(sn(c.asker))}</b> → <b>${esc(sn(c.subject))}</b><small>выучка ${resistOf(c.subject)} · мастерство ${skillOf(c.asker)}</small></div>
        <div class="lf-iq-pg">${polySvg(c)}<div class="lf-iq-bpm"><b>${pulse(c)}</b><small>уд/мин</small></div></div>
        <div class="lf-iq-stress"><i style="width:${c.stress}%"></i></div>
        ${tells(c).length ? `<div class="lf-chips wrap">${tells(c).map(t => `<span class="lf-chip on">${esc(t)}</span>`).join('')}</div>` : ''}
        ${last ? `<div class="lf-note">${esc(last.line)} <small>(d20 ${last.r}${last.mod >= 0 ? '+' : ''}${last.mod})</small></div>` : ''}
        ${A.sec(her ? 'Что она выдала' : 'Что выдал')}
        ${c.goals.map(g => `<div class="lf-iq-goal"><span>${esc(g.t)}</span><div class="lf-iq-bar"><i style="width:${g.got}%"></i></div><small>${gotWord(g.got)}</small></div>`).join('')}
        ${c.st === 'on' ? `${A.sec('Подход')}<div class="lf-chips wrap">${HOW.map(([id, l]) => `<button class="lf-chip" data-act="iq-round" data-v="${id}">${l}</button>`).join('')}</div>` : `<div class="lf-note">${c.st === 'broken' ? (femOf(c.subject) ? 'Раскололась.' : 'Раскололся.') : 'Допрос окончен.'}</div>`}
        <div class="lf-actions"><button class="lf-btn" data-act="iq-stop">${c.st === 'on' ? 'Закончить' : 'Закрыть'}</button></div>`;
}
export const iqState = () => { try { const c = cur(); return c ? (c.st === 'broken' ? 'раскололся' : 'идёт') : ''; } catch { return ''; } };

export function iqClick(act, el) {
    const box = el.closest('#lf-app') || document;
    const val = (k) => box.querySelector(`[data-iqf="${k}"]`)?.value || '';
    if (act === 'iq-side') { ui.side = el.dataset.v === 'her' ? 'her' : 'we'; }
    else if (act === 'iq-kept') {
        const subj = A.canonName(val('subject')), ask = A.canonName(val('asker'));
        ui.goals = val('goals').split('\n').map(t => t.trim()).filter(Boolean);
        const k = subj ? knowKept(subj, ask || A.ctx().name1) : { list: [] };
        if (!k.list.length) { A.toast('info', 'Тайн, которые он держит от допрашивающего, не записано («Кто что знает»)'); return; }
        for (const t of k.list) if (!ui.goals.includes(t)) ui.goals.push(t);
    }
    else if (act === 'iq-start') {
        const goals = val('goals').split('\n').map(t => t.trim()).filter(Boolean);
        if (!start({ side: ui.side, subject: val('subject'), asker: val('asker'), goals })) { A.toast('info', 'Кого и кто — обязательно'); return; }
        ui.goals = [];
    }
    else if (act === 'iq-round') round(el.dataset.v);
    else if (act === 'iq-stop') stop();
    else return;
    A.updatePrompt?.(); A.render();
}
export const _iq = { M, pulse, gotWord };
