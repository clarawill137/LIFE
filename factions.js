// Фракции и репутация. Как к героям относятся группы людей: Щ.И.Т., А.И.М., Мстители, ГИДРА, власти, пресса,
// соседи, бар за углом. У каждой группы шкала от −100 до 100 к каждому из своих, отношение словом и за что;
// сдвиги из постов Летописец записывает с причиной. Люди из группы (или когда о ней речь) ведут себя по счёту.
// Мир → Фракции. Идея — «Фракции и репутация» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { clamp, str, arr } from './hudkit.js';

let A = null;
export function initFactions(api) { A = api; }
const esc = (v) => A.esc(v);

function cfg() {
    const s = A.settings();
    if (!s.fac || typeof s.fac !== 'object') s.fac = {};
    if (s.fac.on === undefined) s.fac.on = true;
    return s.fac;
}
const on = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.fac || typeof cm.fac !== 'object') cm.fac = {};
    if (!Array.isArray(cm.fac.list)) cm.fac.list = [];   // { id, name, note, to: { имя: { v, word } }, log: [{ mes, to, d, why }] }
    if (!Number.isFinite(cm.fac.seq)) cm.fac.seq = 0;
    return cm.fac;
}
const find = (name) => M().list.find(f => A.norm(f.name) === A.norm(name)) || M().list.find(f => A.norm(f.name).includes(A.norm(name)) || A.norm(name).includes(A.norm(f.name)));
const wordOf = (v) => v <= -70 ? 'враги' : v <= -40 ? 'презирают' : v <= -15 ? 'настороже' : v < 15 ? 'нейтрально' : v < 40 ? 'терпят' : v < 70 ? 'уважают' : 'свои';
function ensure(name, note = '') {
    let f = find(name);
    if (!f) { const s = M(); f = { id: `f${++s.seq}`, name: str(name, 60), note: str(note, 160), to: {}, log: [] }; s.list.push(f); }
    return f;
}
const sideOf = (f, who) => { const k = Object.keys(f.to).find(n => A.sameName(n, who)) || who; if (!f.to[k]) f.to[k] = { v: 0, word: '' }; return [k, f.to[k]]; };

const RULE = `
rep — сдвиг репутации героя у ГРУППЫ людей в этом посте (организация, команда, банда, власти, пресса, соседи, заведение): [{"g":"группа — как в «Фракциях», если она там есть","to":"к кому изменилось отношение","d":-10,"word":"отношение теперь, 1-2 слова (уважают, настороже, боятся, свои…)","why":"за что, 3-10 слов"}]. d от −30 до 30. Только заметный сдвиг из-за поступка, провала, огласки или услуги — не личные чувства одного человека. Нечего — [].`;

export function facChron() {
    if (!A?.hasChat?.() || !on()) return null;
    const rows = M().list.slice(0, 12).map(f => `${f.name} (${Object.entries(f.to).map(([n, x]) => `${A.shortName(n)} ${x.v > 0 ? '+' : ''}${x.v}`).join(', ') || '—'})`);
    return { key: '"rep": []', rule: RULE, tokens: 110, input: `Фракции: ${rows.length ? rows.join(' | ') : 'пока нет'}` };
}

export function facAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    // свайп: откатить сдвиги этого поста
    for (const f of s.list) {
        for (const l of f.log.filter(x => x.mes === i)) { const [, side] = sideOf(f, l.to); side.v = clamp(side.v - l.d, -100, 100); side.word = l.prevWord || ''; }
        f.log = f.log.filter(x => x.mes !== i);
    }
    s.list = s.list.filter(f => !(f.mes === i && f.src === 'post' && !f.log.length));
    let changed = false;
    for (const r of arr(j?.rep).slice(0, 4)) {
        const g = str(r?.g, 60), to = A.canonName(str(r?.to, 50)), d = clamp(Math.round(r?.d), -30, 30);
        if (!g || !to || !d) continue;
        const isNew = !find(g);
        const f = ensure(g);
        if (isNew) { f.mes = i; f.src = 'post'; }
        const [k, side] = sideOf(f, to);
        const prevWord = side.word;
        side.v = clamp(side.v + d, -100, 100);
        side.word = str(r?.word, 30) || wordOf(side.v);
        f.log.push({ mes: i, to: k, d, why: str(r?.why, 110), prevWord });
        if (f.log.length > 40) f.log.splice(0, f.log.length - 40);
        changed = true;
    }
    if (changed) A.saveMeta();
}

/** Собрать фракции по истории: кто есть в мире и как относится к своим. */
async function collect() {
    const cast = [A.canonName(A.ctx().name1), ...A.groupMembers().map(A.canonName)].filter(Boolean);
    let people = '';
    try { people = arr(A.peopleList?.()).filter(p => p?.group).slice(0, 40).map(p => `${p.name} — ${p.group}`).join('; '); } catch { /* */ }
    let days = '';
    try { days = A.daysBrief?.() || ''; } catch { /* */ }
    const have = M().list.map(f => f.name);
    const sys = `Ты помощник автора ролевой истории. Составь список ФРАКЦИЙ мира — групп людей, чьё отношение к героям важно для сюжета (организации, команды, власти, банды, пресса, семья как клан, заведения). Ответ — строго один JSON по-русски: {"factions":[{"name":"название","note":"кто это, 4-12 слов","to":[{"who":"имя героя из списка","v":-20,"word":"отношение, 1-2 слова","why":"за что, 3-10 слов"}]}]}. v от −100 до 100 — как группа сейчас относится к герою, по событиям истории и канону мира. От 4 до 9 фракций, только реально значимые; у каждой — отношение к тем героям, к кому оно есть.`;
    const usr = `Герои: ${cast.join(', ')}.${people ? `\nЛюди и их круги: ${people}` : ''}${days ? `\nПоследние дни:\n${A.cut(days, 3500)}` : ''}${have.length ? `\nУже есть (уточни их, новые — добавь): ${have.join(', ')}` : ''}`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: usr }], 1600, { check: (x) => Array.isArray(x?.factions), what: 'Фракции' });
    let n = 0;
    for (const r of arr(j.factions).slice(0, 10)) {
        const name = str(r?.name, 60);
        if (!name) continue;
        const f = ensure(name, str(r?.note, 160));
        if (!f.note) f.note = str(r?.note, 160);
        for (const t of arr(r?.to).slice(0, 6)) {
            const who = A.canonName(str(t?.who, 50));
            if (!who) continue;
            const [k, side] = sideOf(f, who);
            if (f.log.some(l => l.to === k)) continue;      // по этой стороне уже есть сдвиги из постов — не перетирать
            side.v = clamp(Math.round(t?.v), -100, 100);
            side.word = str(t?.word, 30) || wordOf(side.v);
            side.why = str(t?.why, 110);
        }
        n++;
    }
    A.saveMeta();
    return n;
}

export function facPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    if (!s.list.length) return '';
    // о ком речь: имя фракции в двух последних постах или её люди в сцене
    const chat = A.chatArr();
    const text = A.norm(chat.slice(-2).map(m => A.plainText(m?.mes || '')).join(' '));
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    let circles = [];
    try { circles = arr(A.peopleList?.()).filter(p => p?.group && here.some(h => A.sameName(h, p.name))).map(p => A.norm(p.group)); } catch { /* */ }
    const hot = s.list.filter(f => { const n = A.norm(f.name); return (n.length > 2 && text.includes(n)) || circles.some(c => c.includes(n) || n.includes(c)); }).slice(0, 3);
    if (!hot.length) return '';
    const rows = hot.map(f => `${f.name}: ${Object.entries(f.to).filter(([, x]) => x.word || x.v).map(([n, x]) => { const l = f.log.filter(y => y.to === n).slice(-1)[0]; return `к ${A.shortName(n)} — ${x.word || wordOf(x.v)} (${x.v > 0 ? '+' : ''}${x.v}${l?.why ? `: ${l.why}` : x.why ? `: ${x.why}` : ''})`; }).join(', ')}`);
    return `[Репутация: ${rows.join(' | ')}. Люди из этих групп ведут себя по счёту: кому верят — идут навстречу, кого опасаются — проверяют, тянут, отказывают; открыто об этом не говорят.]`;
}

const bar = (v) => `<i class="lf-fac-bar"><b class="${v < 0 ? 'neg' : 'pos'}" style="${v < 0 ? `right:50%;width:${Math.abs(v) / 2}%` : `left:50%;width:${v / 2}%`}"></b></i>`;

/** Мир → Фракции. */
export function facHtml() {
    if (!on()) return '';
    const list = M().list;
    const tools = `<div class="lf-actions tight"><button class="lf-btn" data-act="fac-collect">${A.icon('sparkles')} ${list.length ? 'Уточнить по истории' : 'Собрать по истории'}</button><button class="lf-btn ghost" data-act="fac-add">${A.icon('plus')} Своя</button></div>`;
    if (!list.length) return `${A.sec('Фракции и репутация')}<div class="lf-hint">Как к героям относятся группы людей — Щ.И.Т., А.И.М., власти, пресса, соседи. Сдвиги Летописец запишет сам, с причиной; начальный расклад — «Собрать по истории».</div>${tools}`;
    return `${A.sec('Фракции и репутация', String(list.length))}
    <div class="lf-fac">${list.map(f => `<div class="lf-fac-c"><div class="lf-fac-h"><b>${esc(f.name)}</b><button data-act="fac-del" data-id="${f.id}" title="убрать">${A.icon('x')}</button></div>
        ${f.note ? `<small class="lf-fac-n">${esc(f.note)}</small>` : ''}
        ${Object.entries(f.to).map(([n, x]) => `<div class="lf-fac-r">${A.ava(n, 'xs')}<span><b>${esc(x.word || wordOf(x.v))}</b> <small>${x.v > 0 ? '+' : ''}${x.v}</small>${bar(x.v)}</span><span class="lf-fac-pm"><button data-act="fac-dn" data-id="${f.id}" data-who="${esc(n)}">−</button><button data-act="fac-up" data-id="${f.id}" data-who="${esc(n)}">+</button></span></div>`).join('')}
        ${f.log.length ? `<div class="lf-fac-log">${f.log.slice(-3).reverse().map(l => `<div class="${l.d < 0 ? 'neg' : 'pos'}"><b>${l.d > 0 ? '+' : ''}${l.d}</b> к ${esc(A.shortName(l.to))}${l.why ? ` — ${esc(l.why)}` : ''}</div>`).join('')}</div>` : ''}
    </div>`).join('')}</div>${tools}`;
}

export async function facClick(act, el) {
    if (!act.startsWith('fac-')) return false;
    const s = M();
    const f = s.list.find(x => x.id === el.dataset.id);
    switch (act) {
        case 'fac-collect': { const n = await A.withBusy(el, () => collect(), 'Собираю…'); if (n) A.toast('success', `Фракций: ${n}`, '✦ Фракции'); break; }
        case 'fac-del': if (f) s.list = s.list.filter(x => x !== f); break;
        case 'fac-up': case 'fac-dn': if (f) { const [, side] = sideOf(f, el.dataset.who); side.v = clamp(side.v + (act === 'fac-up' ? 10 : -10), -100, 100); side.word = wordOf(side.v); } break;
        case 'fac-add': {
            const names = [A.canonName(A.ctx().name1), ...A.groupMembers().map(A.canonName)].filter(Boolean);
            A.openSheet(`${A.icon('flag')} Своя фракция`, `
                <div class="lf-field"><label>Название</label><input type="text" data-in="fac-name" placeholder="Щ.И.Т."></div>
                <div class="lf-field"><label>Кто это</label><input type="text" data-in="fac-note" placeholder="разведка, не забывает ничего"></div>
                ${names.map(n => `<div class="lf-field"><label>К ${esc(A.shortName(n))} — от −100 до 100</label><input type="number" min="-100" max="100" step="5" data-in="fac-v" data-name="${esc(n)}" placeholder="пусто — нет отношения"></div>`).join('')}
                <button class="lf-btn primary full" data-act="fac-save">${A.icon('check')} Записать</button>`);
            return true;
        }
        case 'fac-save': {
            const box = el.closest('.lf-sheet') || document;
            const name = box.querySelector('[data-in="fac-name"]')?.value?.trim();
            if (!name) return true;
            const nf = ensure(name, box.querySelector('[data-in="fac-note"]')?.value?.trim() || '');
            for (const inp of box.querySelectorAll('[data-in="fac-v"]')) { if (inp.value === '') continue; const [, side] = sideOf(nf, inp.dataset.name); side.v = clamp(Math.round(Number(inp.value)), -100, 100); side.word = wordOf(side.v); }
            A.closeSheet();
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function facRecs(i) {
    const out = [];
    for (const f of M().list) for (const l of f.log.filter(x => x.mes === i)) out.push({ id: `fac:${f.id}:${l.to}`, g: 'Фракции', icon: 'flag', t: `${f.name}: ${l.d > 0 ? '+' : ''}${l.d} к ${A.shortName(l.to)}${l.why ? ` — ${l.why}` : ''}`, del: () => { const [, side] = sideOf(f, l.to); side.v = clamp(side.v - l.d, -100, 100); side.word = l.prevWord || wordOf(side.v); f.log = f.log.filter(y => y !== l); } });
    return out;
}
