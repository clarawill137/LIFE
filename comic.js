// Комикс: сцена → страница. Умная модель режет последние посты на 3–6 панелей (кадр, плашка-подпись, реплики
// в облачка, мысли — в пузыри-тучки, в боёвке звуковые эффекты), каждая панель рисуется, страница собирается
// сеткой. Стиль — по эпохе и выбору: в 40-х — старый комикс с растром; нуар; карандаш; современный.
// Выпуски — «God Complex #N».

import { str, arr } from './hudkit.js';

let A = null;
export function initComic(api) { A = api; }
const esc = (v) => A.esc(v);
const on = () => A.settings().comic?.on !== false;
export const STYLES = {
    retro: ['Старый комикс 40-х', 'vintage 1940s comic book art, bold ink outlines, halftone Ben-Day dots, limited faded colours, newsprint texture'],
    noir: ['Нуар', 'noir comic art, heavy black ink shadows, stark contrast, rain and neon, limited palette'],
    pencil: ['Карандаш', 'graphic novel pencil art, cross-hatching, soft graphite shading'],
    modern: ['Современный', 'modern superhero comic art, clean inks, cinematic colours'],
};
function M() {
    const cm = A.chatMeta();
    if (!cm.cmx || typeof cm.cmx !== 'object') cm.cmx = {};
    const s = cm.cmx;
    if (!Array.isArray(s.issues)) s.issues = [];   // { id, n, title, style, panels: [{ shot, cap, bubbles: [{ who, t, k }], sfx, who, img }], from, to }
    return s;
}
function year() { try { const d = A.parseDate(A.worldState()?.timestamp?.story_date); return d && !isNaN(d) ? d.getFullYear() : 2024; } catch { return 2024; } }
const SYS = `Ты — сценарист комикса по ролевой истории God Complex (AU по Marvel). Разрежь отрывок на 3–6 панелей одной страницы. Для каждой: кадр по-английски для художника (кто, где, ракурс, действие — без текста в кадре), подпись-плашка по-русски (необязательно, до 12 слов), реплики персонажей по-русски в облачка (коротко, до 14 слов, только то, что звучит или подразумевается в отрывке; мысли — "think"), звуковой эффект для боя по-русски или по-английски (БАХ, КРАК, WHAM) — только если есть действие. Имена в who — как в отрывке.
Только JSON: {"title":"название выпуска, 2–5 слов","panels":[{"shot":"","cap":"","who":[""],"bubbles":[{"who":"","t":"","k":"say|think"}],"sfx":""}]}`;
function excerpt(from, to) {
    const chat = A.chatArr();
    const out = [];
    for (let i = from; i <= to; i++) { const m = chat[i]; if (m && !m.is_system) out.push(`${m.name}: ${String(m.mes || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1400)}`); }
    return out.join('\n\n');
}
/** Сценарий страницы (без картинок). */
export async function script(from, to) {
    const msgs = [{ role: 'system', content: SYS }, { role: 'user', content: excerpt(from, to) }];
    const j = A.askFillJson ? await A.askFillJson(msgs, 2600, { what: 'комикс' }, {}) : A.extractJson(await A.askModel(msgs, 2000));
    const panels = arr(j?.panels).slice(0, 6).map(p => ({ shot: str(p?.shot, 500), cap: str(p?.cap, 90), who: arr(p?.who).map(w => A.canonName(str(w, 40))).filter(Boolean).slice(0, 3), bubbles: arr(p?.bubbles).slice(0, 3).map(b => ({ who: str(b?.who, 40), t: str(b?.t, 120), k: b?.k === 'think' ? 'think' : 'say' })).filter(b => b.t), sfx: str(p?.sfx, 16) })).filter(p => p.shot);
    if (panels.length < 2) throw new Error('модель не разрезала сцену на панели');
    return { title: str(j?.title, 60) || 'Без названия', panels };
}
export async function make(from, to, style = '') {
    const s = M();
    const st = STYLES[style] ? style : year() < 1950 ? 'retro' : 'noir';
    const sc = await script(from, to);
    const x = { id: `x${Date.now().toString(36)}`, n: (s.issues[0]?.n || 0) + 1, title: sc.title, style: st, panels: sc.panels, from, to, at: A.worldState()?.timestamp?.story_date || '' };
    s.issues.unshift(x);
    A.saveMeta();
    return x;
}
/** Нарисовать панели по очереди (уже нарисованные пропускаются). */
export async function drawAll(x, onEach = () => { }) {
    for (const p of x.panels) {
        if (p.img) continue;
        const prompt = `Comic book panel: ${p.shot}\nArt style: ${STYLES[x.style][1]}.${p.who.length ? ` Characters: ${p.who.map((w, i) => `${A.shortName(w)} (reference image ${i + 1}, keep the face)`).join(', ')}.` : ''} No speech bubbles, no captions, no text or letters in the image.`;
        p.img = await A.drawPicture(prompt, { aspect: '4:3', max: 1100, prefix: 'life_cmx', who: p.who });
        A.saveMeta();
        onEach(p);
    }
}

// ───────────── экран ─────────────

const ui = { open: '', style: '' };
function pageHtml(x) {
    return `<div class="lf-cmx-page st-${x.style}"><div class="lf-cmx-head"><b>GOD COMPLEX #${x.n}</b><span>${esc(x.title)}</span></div>
        <div class="lf-cmx-grid n${x.panels.length}">${x.panels.map((p, i) => `<div class="lf-cmx-p">${p.img ? `<img src="${esc(p.img)}" alt="">` : '<i class="lf-cmx-wait">рисую…</i>'}
            ${p.cap ? `<div class="lf-cmx-cap">${esc(p.cap)}</div>` : ''}
            ${p.bubbles.map((b, k) => `<div class="lf-cmx-b ${b.k} b${(i + k) % 2}">${b.who && b.k === 'say' ? `<small>${esc(A.shortName(b.who))}</small>` : ''}${esc(b.t)}</div>`).join('')}
            ${p.sfx ? `<div class="lf-cmx-sfx">${esc(p.sfx)}</div>` : ''}</div>`).join('')}</div></div>`;
}
export function cmxSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const s = M();
    const x = s.issues.find(i => i.id === ui.open);
    const last = A.chatArr().length - 1;
    const st = ui.style || (year() < 1950 ? 'retro' : 'noir');
    return `${A.sec('Комикс', s.issues.length ? `выпусков ${s.issues.length}` : '')}
        <div class="lf-chips wrap">${Object.entries(STYLES).map(([k, [l]]) => `<button class="lf-chip${st === k ? ' on' : ''}" data-act="cmx-style" data-v="${k}">${l}</button>`).join('')}</div>
        <div class="lf-field"><label>Сцена: с поста по последний (#${last})</label><input data-cmxf="from" type="number" value="${Math.max(0, last - 1)}"></div>
        <button class="lf-btn primary wide" data-act="cmx-make">🗯 Сделать страницу</button>
        ${x ? pageHtml(x) : ''}
        ${s.issues.map(i => `<button class="lf-cmx-row${i.id === ui.open ? ' on' : ''}" data-act="cmx-open" data-id="${i.id}">${i.panels[0]?.img ? `<img src="${esc(i.panels[0].img)}" alt="">` : ''}<span><b>#${i.n} · ${esc(i.title)}</b><small>${esc(STYLES[i.style][0])} · ${i.panels.length} панелей${i.at ? ` · ${esc(i.at)}` : ''}</small></span></button>`).join('')}`;
}
export const cmxState = () => { try { return M().issues.length ? `#${M().issues[0].n}` : ''; } catch { return ''; } };
export async function cmxClick(act, el) {
    const box = el.closest('#lf-app') || document;
    if (act === 'cmx-style') ui.style = el.dataset.v;
    else if (act === 'cmx-open') ui.open = ui.open === el.dataset.id ? '' : el.dataset.id;
    else if (act === 'cmx-make') {
        const last = A.chatArr().length - 1;
        const from = Math.max(0, Math.min(last, Number(box.querySelector('[data-cmxf="from"]')?.value) || last));
        const x = await A.withBusy(el, () => make(from, last, ui.style), 'Режу на панели…');
        if (!x) return;
        ui.open = x.id;
        A.render();
        try { await drawAll(x, () => A.render()); } catch (e) { A.toast('warning', esc(String(e?.message || e))); }
    }
    else return;
    A.render();
}
export const _cmx = { M, ui, pageHtml };
