// Плашки газеты и письма прямо в постах: модель вставляет блок ||NEWS||…||END|| или ||LETTER||…||END||
// в момент события, а SillyTavern рисует его своими regex-скриптами (старая бумага, сургуч).
// Вёрстка плашек — чужая (тема «Контракт»), поэтому в эту публичную репу она не кладётся:
// файл лежит только на сервере, в user/files/life-plates.json, и Life ставит из него regex-скрипты сам.

let A = null;
let pack = null;
const URL = '/user/files/life-plates.json';

export function initPlates(api) { A = api; }
const cfg = () => A.settings().plates;
export const platesPack = () => pack;

/** Подтянуть файл с сервера, поставить или выключить regex-скрипты, шрифты. */
export async function platesSync() {
    const c = cfg();
    try {
        const r = await fetch(`${URL}?t=${Date.now()}`, { cache: 'no-store' });
        pack = r.ok ? await r.json() : null;
    } catch { pack = null; }
    c.found = !!pack;
    if (!pack) return;
    const ext = A.ctx().extensionSettings;
    if (!Array.isArray(ext.regex)) ext.regex = [];
    let changed = false;
    for (const sc of [pack.news, pack.letter]) {
        if (!sc?.id) continue;
        const i = ext.regex.findIndex(x => x?.id === sc.id);
        if (i < 0) { if (c.on) { ext.regex.push({ ...sc, disabled: false }); changed = true; } continue; }
        const cur = ext.regex[i];
        const next = { ...cur, findRegex: sc.findRegex, replaceString: sc.replaceString, disabled: !c.on };
        if (cur.findRegex !== next.findRegex || cur.replaceString !== next.replaceString || !!cur.disabled !== next.disabled) { ext.regex[i] = next; changed = true; }
    }
    if (changed) A.saveSettings();
    if (c.on && pack.fonts && !document.getElementById('life-plates-fonts')) {
        const l = document.createElement('link');
        l.id = 'life-plates-fonts'; l.rel = 'stylesheet'; l.href = pack.fonts;
        document.head.append(l);
    }
}

/** Правило для модели — только если плашки включены и стоят. */
export function platesPrompt() {
    const c = cfg();
    if (!c.on || !pack) return '';
    return `[ПЛАШКИ: ГАЗЕТА И ПИСЬМА — in-world blocks in the exact formats below. Labels exact; values in Russian; one line per field; no markdown; no line breaks inside a field.
WHEN. An EVENT is something the world would notice or talk about: a crime, death, arrest or fight; a scandal or exposed secret; a notable person appearing in public; a public confrontation or display of power; a deal, wedding, funeral or official act; a discovery; a fire, accident or disaster; a big gathering. NOT events: private talk, thoughts, meals, rest, errands.
- NEWS: after an EVENT, one newspaper block as the press's account of it, right after the event; also whenever a paper is read or a headline is heard in the scene. Never cover the same event twice; a real development may get a follow-up.
- LETTER: when a character would plausibly write (invitation, note, condolences, summons, threat, report), one letter block at the moment it arrives; also whenever a letter is read or written out in the scene. A letter only mentioned is not shown. Never repeat a letter.
At most one NEWS and one LETTER per reply, usually none. Insert each block at that moment, on its own lines with a blank line before and after, then continue the story. A block in {{user}}'s message is authoritative. Never decide anything for {{user}}.
||NEWS||
PAPER: newspaper title fitting this place and era (invented)
DATE: weekday and date in the story's calendar
HEADLINE: 4-10 words
DECK: one-line subheading (optional)
P1: lead paragraph, 30-45 words
P2: second paragraph, 20-35 words (optional)
BRIEF: one-sentence city item, up to 22 words
BRIEF: second item
BRIEF: third item
||END||
Exactly three BRIEF lines (atmosphere, may quietly hint at other threads). Written as the press would: public facts only, with bias, rumour or small errors; never what a newsroom could not know. Press register of the story's era and country.
||LETTER||
FROM: sender's name and rank or position as on the letterhead
PLACE: place and date line
TO: salutation
P1: first paragraph, 30-50 words
P2: second paragraph (optional)
P3: third paragraph (optional)
CLOSE: complimentary close
SIGN: signature
PS: postscript beginning with P.S. (optional)
SEAL: one or two letters for the wax seal, usually the sender's initial
WAX: wax colour as a hue 0-359 (355 crimson, 345 claret, 220 blue, 140 green, 40 gold) or 360 for black
||END||
Black wax (360) for death notices, threats and grim news. In the sender's own voice and rank; a letter written by {{user}} is only formatted from what {{user}} wrote. At most 120 words in total.]`;
}

/** Газета Life (Мир → СМИ) в той же вёрстке, что плашка в посте. '' — если плашек нет на сервере. */
export function gazetteHtml(d) {
    const sc = pack?.news;
    if (!sc?.replaceString) return '';
    const e = (v) => A.esc(String(v || ''));
    const sent = (String(d.lead || '').match(/[^.!?…]+[.!?…]*\s*/g) || []).map(x => x.trim()).filter(Boolean);
    const half = Math.max(1, Math.ceil(sent.length / 2));
    const vals = ['', d.outlet, [A.weekday(d.date), d.date].filter(Boolean).join(', '), d.headline, d.deck, sent.slice(0, half).join(' '), sent.slice(half).join(' '), d.news?.[0], d.news?.[1], d.news?.[2]];
    return sc.replaceString.replace(/\$(\d)/g, (_, n) => e(vals[Number(n)]));
}
