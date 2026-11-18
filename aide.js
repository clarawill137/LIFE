// Ассистент сюжета. Чат «на полях» — не в истории: спросить, почему персонаж так себя ведёт, что он скрывает,
// что может случиться дальше, обсудить, куда вести сцену. Отвечает моделью Летописца по тому, что знает Life
// (то же, что уходит модели), последним дням и постам. В чат истории ничего не пишется. Договорились о чём-то —
// «→ режиссёру»: уйдёт модели один раз, со следующим ответом, и только по твоему тапу.

let A = null;
export function initAide(api) { A = api; }
const esc = (v) => A.esc(v);

function M() {
    const cm = A.chatMeta();
    if (!cm.aide || typeof cm.aide !== 'object') cm.aide = {};
    if (!Array.isArray(cm.aide.log)) cm.aide.log = [];   // { r: 'u'|'a', t }
    return cm.aide;
}

let busy = false;

async function ask(q) {
    const s = M();
    const chat = A.chatArr();
    const posts = [];
    for (let i = chat.length - 1; i >= 0 && posts.length < 6; i--) if (A.isPost(chat[i])) posts.unshift(`${chat[i].name}: ${A.cut(A.plainText(chat[i].mes), 1600)}`);
    let state = '';
    try { state = (A.promptParts?.() || []).filter(p => p?.text).map(p => `— ${p.label}: ${A.cut(p.text, 700)}`).join('\n'); } catch { /* */ }
    let days = '';
    try { days = A.daysBrief?.() || ''; } catch { /* */ }
    const user = A.shortName(A.canonName(A.ctx().name1));
    const sys = `Ты — помощник автора ролевой истории, разговор «на полях»: это не часть истории и в неё не попадёт. Собеседница играет за ${user}. Отвечай по-русски, по делу и коротко (до 8 предложений, без списков, если не просят): почему персонаж так себя ведёт, что он может скрывать, что вытекает из уже случившегося, какие есть варианты хода. Опирайся только на данное ниже; чего там нет — так и скажи, не выдумывай фактов. Не пиши пост за персонажей. Если вы о чём-то условились для следующего ответа модели — закончи отдельной строкой «ДОГОВОРИЛИСЬ: …» (одна фраза-указание рассказчику), иначе такой строки не пиши.`;
    const ctx = `Сейчас: ${A.worldState()?.timestamp?.story_date || '—'} ${A.worldState()?.timestamp?.story_time || ''}, ${A.worldState()?.scene?.location || ''}.${days ? `\nПоследние дни:\n${A.cut(days, 3000)}` : ''}${state ? `\nЧто знает Life:\n${A.cut(state, 7000)}` : ''}\nПоследние посты:\n${posts.join('\n\n')}`;
    const hist = s.log.slice(-10).map(x => ({ role: x.r === 'u' ? 'user' : 'assistant', content: x.t }));
    const out = await A.askModel([{ role: 'system', content: sys }, { role: 'user', content: ctx }, { role: 'assistant', content: 'Историю вижу. Спрашивай.' }, ...hist, { role: 'user', content: q }], 900, 'Ассистент сюжета');
    const text = String(out || '').replace(/```[\s\S]*?```/g, '').trim();
    if (!text) throw new Error('ассистент ответил пусто — попробуй ещё раз');
    s.log.push({ r: 'u', t: q.slice(0, 1200) }, { r: 'a', t: text.slice(0, 4000) });
    if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
    A.saveMeta();
}

const deal = (t) => { const m = String(t).match(/ДОГОВОРИЛИСЬ:\s*(.+)\s*$/i); return m ? m[1].trim() : ''; };

function body() {
    const s = M();
    const rows = s.log.slice(-24).map((x, k, a) => { const idx = s.log.length - a.length + k; const d = x.r === 'a' ? deal(x.t) : ''; return `<div class="lf-aid-m ${x.r}"><p>${esc(d ? x.t.replace(/ДОГОВОРИЛИСЬ:[\s\S]*$/i, '').trim() : x.t).replace(/\n+/g, '</p><p>')}</p>${d ? `<div class="lf-aid-d"><small>договорились</small>${esc(d)}<button class="lf-btn primary" data-act="aid-send" data-n="${idx}">${A.icon('zap')} → режиссёру</button></div>` : ''}</div>`; }).join('');
    return `<div class="lf-aid">${rows || '<div class="lf-hint">Спроси что угодно про историю: «почему он промолчал?», «что Тони знает про нас?», «куда это может пойти?». В чат ничего не попадёт.</div>'}</div>
    <div class="lf-aid-in"><textarea rows="2" data-in="aid-q" placeholder="Твой вопрос…"></textarea><button class="lf-btn primary" data-act="aid-ask">${A.icon('check')}</button></div>
    ${s.log.length ? '<button class="lf-link" data-act="aid-clear">очистить разговор</button>' : ''}`;
}

export function aideSceneHtml() {
    if (!A?.hasChat?.() || A.settings().aide?.on === false) return '';
    return `<button class="lf-btn ghost full" data-act="aid-open">💬 Спросить про сюжет</button>`;
}

export async function aideClick(act, el) {
    if (!act.startsWith('aid-')) return false;
    const s = M();
    const open = () => A.openSheet('💬 Ассистент сюжета', body(), (box) => { const b = box?.querySelector?.('.lf-aid'); if (b) b.scrollTop = b.scrollHeight; });
    switch (act) {
        case 'aid-open': open(); return true;
        case 'aid-clear': s.log = []; A.saveMeta(); open(); return true;
        case 'aid-ask': {
            if (busy) return true;
            const box = el.closest('.lf-sheet') || document;
            const q = box.querySelector('[data-in="aid-q"]')?.value?.trim();
            if (!q) return true;
            busy = true;
            try { await A.withBusy(el, () => ask(q), '…'); } finally { busy = false; }
            open();
            return true;
        }
        case 'aid-send': {
            const d = deal(s.log[Number(el.dataset.n)]?.t || '');
            if (!d) return true;
            A.chatMeta().director = { text: d, once: true, after: A.lastAiIndex() };
            A.saveMeta(); A.updatePrompt();
            A.toast('success', 'Уйдёт модели один раз — со следующим ответом', '✦ Режиссёр', { timeOut: 2200 });
            return true;
        }
    }
    return false;
}
