// Каждый пишет за себя: в групповом чате ход одного персонажа — он и пишет.
// Остальные главные — только глазами говорящего и коротко (реплика-другая в диалоге), без их мыслей,
// монологов и цепочек действий; кого нет в сцене (по Horae) — не появляются, не говорят и не получают
// «тем временем за триста миль отсюда». Рассказчик/мастер — пишет всех, как раньше.
// Текст уходит в конец промпта вместе с режимами (там модель его держит).
// Кого нет рядом, но кто хочет войти, — «стучится» (knock.js): ты пускаешь, и в его ход модель знает, как он входит.

import { knockPromptFor } from './knock.js';

let A = null;
export function initCast(api) { A = api; }

const NARRATOR = /рассказчик|narrator|мастер|game ?master|(^|[^a-z])gm([^a-z]|$)|мнемозина/i;

export function castPrompt(type, consume = false) {
    if (!A?.hasChat?.() || type === 'quiet' || type === 'impersonate') return '';
    if (A.settings().cast?.on === false) return '';
    const c = SillyTavern.getContext();
    if (!c.groupId) return '';
    const S = String(c.name2 || '').trim();
    if (!S || NARRATOR.test(S)) return '';
    const U = c.name1 || 'the player';
    const same = A.sameName;
    const others = (A.groupMembers() || []).filter(n => !same(n, S) && !same(n, U) && !NARRATOR.test(n));
    let present = [];
    try { present = (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean); } catch { /* без Horae */ }
    const known = present.length > 0;
    const isHere = (n) => present.some(p => same(p, n));
    const here = known ? others.filter(isHere) : others;
    const away = known ? others.filter(n => !isHere(n)) : [];
    const speakerAway = known && !isHere(S);

    const L = [`[TURN — this reply belongs to ${S} alone. Write ${S}: their actions, words, thoughts and what they notice; the world and minor NPCs may move around them.`];
    const only = `show them only through ${S}'s eyes — at most one short line or a reaction when the dialogue truly needs it. Never their thoughts, their speeches, or a chain of their actions; don't move their story forward for them.`;
    if (!known && here.length) L.push(`- ${here.join(', ')} speak and act in their own turns. If any of them is around, ${only} If they are not around, they don't appear and there are no cutaways to them.`);
    else if (here.length) L.push(`- ${here.join(', ')} ${here.length > 1 ? 'are' : 'is'} in the scene but ${here.length > 1 ? 'speak and act' : 'speaks and acts'} in their own turns: ${only}`);
    else L.push(`- Other main characters speak and act in their own turns: if one is around, ${only}`);
    if (away.length) L.push(`- Not in this scene: ${away.join(', ')}. They don't appear, walk in, speak or act in this reply, and there are no cutaways to what they are doing elsewhere («тем временем…», «за триста миль отсюда…»). At most ${S} thinks of them or mentions them.`);
    let enter = '';
    try { enter = knockPromptFor(S, U, consume); } catch { /* */ }
    if (enter) L.push(enter);
    else if (speakerAway) L.push(`- ${S} is not with ${U} right now: write ${S} where ${S} actually is (or reaching ${U} by phone) — no teleporting into the scene.`);
    L.push(`- Never write ${U}'s words, actions or thoughts.]`);
    return L.join('\n');
}
