// Близость: подробности и пульт (18+, тот же выключатель, что у «Хода близости»).
// Подробности ведёт Летописец, пока идёт сцена: поза целиком, у каждого — близость к пику (0–100) и как это
// видно, пульс, карта тела (какие зоны горят), что осталось из одежды и белья, звуки. Отдельно копится
// постоянное: что его заводит, фетиши, табу и что гасит желание — из сцен и по карточке, правится руками.
// Пульт — ручное управление: поза, темп, где, слова, акценты, защита держатся, пока не снимешь; команды
// («дразнить дольше», «к финалу», «ещё заход») уходят в один ответ. Тон (нежно, жёстко, кто ведёт) остался
// в «Настроении сцены». Идея полей — блок «Взрослые сцены» TavernOS HUD (alewwi), см. NOTICE-HUD.md.

import { str, arr, clamp, similar, mains } from './hudkit.js';

let A = null;
export function initLust(api) { A = api; }
const esc = (v) => A.esc(v);

const SRC = 'Близость';
const HOT = /(секс|трах|раздева|расст[её]г|стон|целу|поцелу|в постел|оргазм|кончи|возбужд|ласка|член|грудь|бёдр|бедр|нагот|голы[йе]|голая|обнаж)/i;
const KIND = { kink: 'заводит', fetish: 'фетиш', nogo: 'табу', cold: 'гасит', libido: 'либидо', exp: 'опыт' };
const TREND = { up: '↑', peak: '●', down: '↓' };

const POSES = ['лицом к лицу, он сверху', 'она сверху', 'она сверху, спиной к нему', 'сзади, она на коленях', 'на боку, он сзади', 'стоя, у стены', 'она на краю стола', 'сидя, она у него на коленях', 'она на животе, он сверху', 'он ртом — ей', 'она ртом — ему', 'руками, не раздеваясь до конца'];
const BELLY_OK = /на боку|она сверху|на коленях|сидя|ртом|руками/;
const PACE = ['медленно, тягуче', 'ровно и глубоко', 'быстро, жадно', 'рвано — то замирая, то срываясь'];
const WHERE = ['в постели', 'до кровати не дошли', 'в душе', 'на кухне', 'у стены', 'на диване', 'на полу', 'в машине'];
const WORDS = ['почти молча', 'шёпотом на ухо', 'говорят не замолкая', 'грязные словечки', 'со смехом'];
const ACCENT = ['долгие поцелуи', 'шея и ключицы', 'сплетённые пальцы', 'железная рука — осторожно и нарочно', 'глаза в глаза', 'одежда не до конца', 'перед зеркалом', 'он держит её запястья', 'она царапает спину', 'он на коленях перед ней', 'при свете', 'в темноте, на ощупь'];
const PROT = ['с презервативом', 'без защиты — оба знают', 'защита не нужна'];
const NOW = ['дразнить дольше — к делу не переходить', 'переходить к делу', 'сменить позу — по ходу, без паузы', 'к финалу', 'финал — она первая', 'финал — он первый', 'финал — вместе', 'ещё заход, без передышки', 'перерыв: вода, смех, разговор', 'заканчивать — и забота после'];

const on = () => A.settings().heat?.on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.lust || typeof cm.lust !== 'object') cm.lust = {};
    const s = cm.lust;
    if (!s.traits || typeof s.traits !== 'object') s.traits = {};   // имя → [{ kind, t, mes }]
    return s;
}
const live = () => !!A.chatMeta().heat?.cur;
const traitsOf = (who) => { const k = Object.keys(M().traits).find(n => A.sameName(n, who)); return k ? M().traits[k] : []; };

function wanted(i) {
    if (live()) return true;
    try { const n = A.moodNow?.(); if (n?.intimOn || n?.intimLevel) return true; } catch { /* */ }
    return HOT.test(A.plainText(A.chatArr()[i]?.mes || '').slice(0, 6000));
}

const RULE_HOT = `
hot — подробности идущей сексуальной сцены (взрослые, по согласию). ТОЛЬКО если в посте идёт секс, иначе null: {"pose":"поза целиком: кто где, как расположены тела, руки, вес, угол и ритм — 6-20 слов","who":[{"name":"имя","edge":70,"shows":"как это видно: дыхание, голос, мышцы, слова — 4-12 слов","pulse":120,"breath":"дыхание, 2-5 слов","body":"что с его телом сейчас — откровенно, словами поста: возбуждение и как оно видно, где и как касаются, как тело отвечает; 6-22 слова","zones":[{"z":"шея","v":8,"tr":"up|peak|down","t":"что с ней происходит, 2-8 слов"}],"wear":"что на нём осталось и в каком виде (бельё сдвинуто, рубашка расстёгнута) — 2-10 слов, или пусто"}],"sounds":["звук и на что похож, 2-8 слов"]}. edge — близость к пику 0-100; zones — до 4 самых чувствительных сейчас зон тела, v — 0-10; sounds — до 3. Только по тексту поста.`;
const RULE_TURN = `
turnons — что в этом посте СТАЛО ЯСНО про постоянные сексуальные вкусы взрослого персонажа: [{"who":"имя","kind":"kink|fetish|nogo|cold","t":"что именно, 2-10 слов"}]. kink — практика или динамика, которая заводит; fetish — вещь, часть тела или обстановка; nogo — жёсткий отказ; cold — то, что гасит желание. Только явное в тексте, не разовое настроение. Нечего — [].`;

export function lustChron(i) {
    if (!A?.hasChat?.() || !on() || !wanted(i)) return null;
    return { key: '"hot": null, "turnons": []', rule: `${RULE_HOT}${RULE_TURN}`, tokens: 420, input: '' };
}

function addTrait(who, kind, t, mes) {
    const s = M();
    if (!who || !KIND[kind] || !t) return false;
    const k = Object.keys(s.traits).find(n => A.sameName(n, who)) || who;
    const list = s.traits[k] = s.traits[k] || [];
    if (list.some(x => x.kind === kind && (A.norm(x.t) === A.norm(t) || similar(A, x.t, t, 0.7)))) return false;
    list.push({ kind, t, mes });
    if (list.length > 40) list.splice(0, list.length - 40);
    return true;
}

export function lustAfterPost(i, j) {
    if (!on()) return;
    const s = M();
    // свайп: убрать вкусы, записанные этим постом
    for (const k of Object.keys(s.traits)) s.traits[k] = s.traits[k].filter(x => x.mes !== i);
    let changed = false;
    const h = j?.hot;
    if (h && typeof h === 'object') {
        s.cur = {
            mes: i, pose: str(h.pose, 220), sounds: arr(h.sounds).map(x => str(x, 80)).filter(Boolean).slice(0, 3),
            who: arr(h.who).slice(0, 3).map(w => ({
                name: A.canonName(str(w?.name, 50)), edge: clamp(Math.round(w?.edge), 0, 100), shows: str(w?.shows, 140), pulse: clamp(Math.round(w?.pulse) || 0, 0, 220), breath: str(w?.breath, 50), body: str(w?.body, 240), wear: str(w?.wear, 120),
                zones: arr(w?.zones).slice(0, 4).map(z => ({ z: str(z?.z, 30), v: clamp(Math.round(z?.v), 0, 10), tr: TREND[str(z?.tr)] ? str(z.tr) : '', t: str(z?.t, 80) })).filter(z => z.z),
            })).filter(w => w.name),
        };
        changed = true;
    } else if (s.cur && !live()) { s.cur = null; changed = true; }
    for (const r of arr(j?.turnons).slice(0, 4)) if (addTrait(A.canonName(str(r?.who, 50)), str(r?.kind), str(r?.t, 90), i)) changed = true;
    // сцена кончилась — «держать» из пульта снять
    try { if (A.chatMeta().heat?.ended?.mes === i) A.cueClear?.(SRC); } catch { /* */ }
    if (changed) A.saveMeta();
}

async function collect(who) {
    const card = A.cardOf(who);
    let desc = [card?.description, card?.personality].filter(Boolean).join('\n').slice(0, 5000);
    let core = '';
    try { core = A.coreOf?.(who) || ''; } catch { /* */ }
    if (!desc && !core) throw new Error(`не нашла описание ${who} — впиши руками`);
    const sys = `Ты помощник автора взрослой ролевой истории (все персонажи совершеннолетние). По описанию персонажа выпиши его постоянные сексуальные вкусы. Ответ — строго один JSON по-русски: {"list":[{"kind":"kink|fetish|nogo|cold|libido|exp","t":"что именно, 2-12 слов"}]}. kink — практики и динамика, которые заводят; fetish — вещи, части тела, обстановка; nogo — жёсткие отказы и почему; cold — что гасит желание; libido — как часто хочет и что питает или глушит желание (одна запись); exp — опыт: сколько и какого было до этой истории (одна запись). До 12, только то, что следует из описания, травм и характера; не выдумывай.`;
    const j = await A.askJson([{ role: 'system', content: sys }, { role: 'user', content: `Персонаж: ${who}.\n${desc}${core ? `\nЯдро: ${A.cut(core, 900)}` : ''}` }], 900, { check: (x) => Array.isArray(x?.list), what: `Вкусы — ${A.shortName(who)}` });
    let n = 0;
    for (const r of arr(j.list).slice(0, 12)) if (addTrait(who, str(r?.kind), str(r?.t, 110), -1)) n++;
    A.saveMeta();
    return n;
}

export function lustPrompt(type) {
    if (!A?.hasChat?.() || !on() || type === 'quiet' || type === 'impersonate') return '';
    const s = M();
    let hot = live();
    if (!hot) { try { hot = !!A.moodNow?.()?.intimOn; } catch { /* */ } }
    if (!hot) return '';
    const out = [];
    const c = s.cur;
    if (c && live()) {
        const who = c.who.map(w => `${A.shortName(w.name)} — до пика ${w.edge}/100${w.shows ? ` (${w.shows})` : ''}${w.wear ? `; на нём/ней: ${w.wear}` : ''}${w.zones.length ? `; горит: ${w.zones.map(z => `${z.z} ${z.v}/10`).join(', ')}` : ''}`);
        out.push(`[Тела в сцене: ${c.pose ? `поза — ${c.pose}. ` : ''}${who.join(' | ')}. Продолжай отсюда: шкала не падает без причины и не прыгает к ста за одну фразу; что снято — снято, что осталось — мешает или дразнит.]`);
    }
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName);
    const rows = [];
    for (const n of [A.canonName(A.ctx().name1), ...mains(A)]) {
        if (here.length && !here.some(h => A.sameName(h, n))) continue;
        const t = traitsOf(n).filter(x => !x.off);
        if (!t.length) continue;
        const by = (k) => t.filter(x => x.kind === k).slice(-5).map(x => x.t).join(', ');
        rows.push(`${A.shortName(n)}: ${[by('kink') && `заводит — ${by('kink')}`, by('fetish') && `фетиши — ${by('fetish')}`, by('nogo') && `ТАБУ, не пересекать — ${by('nogo')}`, by('cold') && `гасит — ${by('cold')}`, by('libido') && `либидо — ${by('libido')}`].filter(Boolean).join('; ')}`);
    }
    if (rows.length) out.push(`[Вкусы в постели: ${rows.join(' | ')}. Табу не нарушается и не «проверяется»; остальное — краска, к месту, не списком.]`);
    return out.join('\n');
}

const group = (title, key, list, mark) => `<div class="lf-cue-g"><small>${title}</small><div class="lf-chips wrap">${list.map(t => A.cueChip(SRC, key || `acc:${t}`, key ? `${title} — ${t}` : t, { label: `${t}${mark?.(t) ? ' 🤰' : ''}` })).join('')}</div></div>`;

/** Пульт близости — ручное управление. */
export function lustPultHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    let preg = false;
    try { preg = !!A.moodNow?.()?.preg; } catch { /* */ }
    const kinks = [...new Set([A.canonName(A.ctx().name1), ...mains(A)].flatMap(n => traitsOf(n).filter(x => !x.off && (x.kind === 'kink' || x.kind === 'fetish')).map(x => x.t)))].slice(0, 10);
    return `${A.sec('Пульт близости', 'твой тап — в промпт')}
    <div class="lf-cue-g"><small>сейчас — в следующий ответ</small><div class="lf-chips wrap">${NOW.map(t => A.cueChip(SRC, `now:${t}`, t, { once: true })).join('')}</div></div>
    ${group('поза', 'pose', POSES, preg ? (t) => BELLY_OK.test(t) : null)}
    ${group('темп', 'pace', PACE)}
    ${group('где', 'where', WHERE)}
    ${group('слова', 'words', WORDS)}
    ${group('акценты', '', ACCENT)}
    ${kinks.length ? group('из их вкусов', '', kinks) : ''}
    ${group('защита', 'prot', PROT)}
    ${A.cueOwnHtml(SRC)}
    ${A.cueStripHtml(SRC)}
    <div class="lf-hint">Чипы «держать» горят, пока не тапнешь ещё раз, и сами гаснут, когда сцена кончится. Тон — нежно, жёстко, кто ведёт — в «Настроении сцены».${preg ? ' 🤰 — удобно с животом.' : ''}</div>`;
}

export function lustSceneHtml() {
    if (!A?.hasChat?.() || !on()) return '';
    const c = M().cur;
    if (!c || !live()) return '';
    return `${A.sec('Тела в сцене')}
    <div class="lf-lu">
        ${c.pose ? `<div class="lf-lu-pose">${esc(c.pose)}</div>` : ''}
        ${c.who.map(w => `<div class="lf-lu-w"><div class="lf-lu-h">${A.ava(w.name, 'xs')}<b>${esc(A.shortName(w.name))}</b>${w.pulse || w.breath ? `<small>${w.pulse ? `♥ ${w.pulse}` : ''}${w.breath ? ` · ${esc(w.breath)}` : ''}</small>` : ''}</div>
            <div class="lf-lu-edge"><i><u style="width:${w.edge}%"></u></i><b>${w.edge}</b></div>
            ${w.shows ? `<p>${esc(w.shows)}</p>` : ''}
            ${w.body ? `<p class="lf-lu-body">${esc(w.body)}</p>` : ''}
            ${w.zones.length ? `<div class="lf-lu-z">${w.zones.map(z => `<span style="--v:${z.v / 10}" title="${esc(z.t)}">${esc(z.z)} <b>${z.v}</b>${z.tr ? ` ${TREND[z.tr]}` : ''}</span>`).join('')}</div>` : ''}
            ${w.wear ? `<small class="lf-lu-wear">на нём/ней: ${esc(w.wear)}</small>` : ''}</div>`).join('')}
        ${c.sounds.length ? `<div class="lf-hint">🔊 ${esc(c.sounds.join(' · '))}</div>` : ''}
    </div>`;
}

/** Персонаж → Жизнь → Психика: вкусы и «последний раз». */
export function lustHtml(who) {
    if (!on()) return '';
    const name = A.canonName(who);
    const t = traitsOf(name);
    const last = (A.chatMeta().heat?.past || []).slice(-1)[0];
    const lastLine = last ? `последний раз: ${last.end ? new Date(last.end).toLocaleDateString('ru') : `пост #${last.to}`}${last.ts && last.end ? `, шло ~${Math.max(1, Math.round((last.end - last.ts) / 60000))} мин` : ''}, заходов ${last.rounds || 1}${last.prot ? `, защита: ${last.prot}` : ''}` : '';
    const kindBlock = (k) => { const l = t.filter(x => x.kind === k); return l.length ? `<div class="lf-lu-k k-${k}"><small>${KIND[k]}</small>${l.map(x => `<span class="${x.off ? 'off' : ''}">${esc(x.t)}<button data-act="lu-del" data-who="${esc(name)}" data-n="${t.indexOf(x)}">✕</button></span>`).join('')}</div>` : ''; };
    return `${A.sec('В постели', '18+')}
    ${lastLine ? `<div class="lf-hint">${esc(lastLine)}</div>` : ''}
    ${t.length ? Object.keys(KIND).map(kindBlock).join('') : '<div class="lf-hint">Что заводит, фетиши, табу и что гасит желание. Летописец допишет из сцен; можно собрать по карточке или вписать самой.</div>'}
    <div class="lf-actions tight"><button class="lf-btn" data-act="lu-collect" data-who="${esc(name)}">${A.icon('sparkles')} По карточке</button><button class="lf-btn ghost" data-act="lu-add" data-who="${esc(name)}">${A.icon('plus')} Своё</button></div>`;
}

export async function lustClick(act, el) {
    if (!act.startsWith('lu-')) return false;
    const s = M();
    const who = A.canonName(el.dataset.who || '');
    const k = Object.keys(s.traits).find(n => A.sameName(n, who)) || who;
    switch (act) {
        case 'lu-collect': { const n = await A.withBusy(el, () => collect(who), 'Собираю…'); if (n === 0) A.toast('info', 'Нового в описании не нашлось.', '✦ Вкусы'); break; }
        case 'lu-del': if (s.traits[k]) s.traits[k].splice(Number(el.dataset.n), 1); break;
        case 'lu-add':
            A.openSheet(`${A.icon('heart')} Вкус — ${esc(A.shortName(who))}`, `<div class="lf-field"><label>Что это</label><select data-in="lu-kind">${Object.entries(KIND).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
                <div class="lf-field"><label>Что именно</label><input type="text" data-in="lu-t" placeholder="когда она командует вслух"></div>
                <button class="lf-btn primary full" data-act="lu-save" data-who="${esc(who)}">${A.icon('check')} Записать</button>`);
            return true;
        case 'lu-save': {
            const box = el.closest('.lf-sheet') || document;
            if (!addTrait(who, box.querySelector('[data-in="lu-kind"]')?.value, str(box.querySelector('[data-in="lu-t"]')?.value, 90), -1)) return true;
            A.closeSheet();
            break;
        }
        default: return false;
    }
    A.saveMeta(); A.updatePrompt(); A.render();
    return true;
}

export function lustRecs(i) {
    const s = M();
    const out = [];
    for (const [n, list] of Object.entries(s.traits)) for (const x of list) if (x.mes === i) out.push({ id: `lu:${n}:${x.t}`, g: 'Близость', icon: 'heart', t: `${A.shortName(n)} — ${KIND[x.kind]}: ${x.t}`, del: () => { s.traits[n] = s.traits[n].filter(y => y !== x); } });
    return out;
}
