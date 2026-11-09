// Не пропусти. Перед ответом дешёвая модель вытаскивает из твоего поста то, на что надо отреагировать:
// вопросы, просьбы, брошенные фразы и шутки, жесты и прикосновения, отданные вещи, решения, новости.
// Модель получает это одной заметкой в самом конце промпта; под твоим постом — чипы: ждёт / ✓ ответил / пропустил.
// Летописец после ответа отмечает, на что ответили; пропущенное один раз переходит в следующий ответ.

let A = null;
export function initReply(api) { A = api; }

const esc = (v) => A.esc(v);
const userName = () => A.canonName(A.ctx().name1) || A.ctx().name1 || 'игрок';

function cfg() {
    const s = A.settings();
    if (!s.reply || typeof s.reply !== 'object') s.reply = {};
    const c = s.reply;
    if (c.on === undefined) c.on = true;
    if (!Number.isFinite(c.wait)) c.wait = 8;
    return c;
}
export const replyOn = () => cfg().on !== false;

function M() {
    const cm = A.chatMeta();
    if (!cm.reply || typeof cm.reply !== 'object') cm.reply = {};
    if (!cm.reply.list || typeof cm.reply.list !== 'object') cm.reply.list = {};
    return cm.reply;
}

const keyOf = (i) => { const m = A.chatArr()[i]; return m ? `${i}:${A.hash(m.mes || '')}` : ''; };

/** Последний пост игрока, на который сейчас отвечают (между ним и ответом — только системные). */
function userIndexFor(type) {
    const chat = A.chatArr();
    let end = chat.length - 1;
    if (type === 'swipe') end = chat.length - 2;
    for (let i = end; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        return m.is_user ? i : -1;
    }
    return -1;
}

/** Для ответа на месте i — пост игрока перед ним (если между ними только системные). */
function userIndexBefore(i) {
    const chat = A.chatArr();
    for (let j = i - 1; j >= 0; j--) {
        const m = chat[j];
        if (!m || m.is_system) continue;
        return m.is_user ? j : -1;
    }
    return -1;
}

const SYSTEM = `Ты помощник рассказчика в литературной ролевой на русском. Тебе дают пост игрока и, для контекста, конец предыдущего поста.
Выпиши, на что в посте игрока персонажи ОБЯЗАТЕЛЬНО должны отреагировать в следующем ответе, чтобы ничего не потерялось: прямые вопросы, просьбы и предложения, признания, брошенные фразы и шутки, подколы, жесты и прикосновения, отданные или показанные вещи, решения, новости.
1–5 пунктов, только значимое, по порядку поста; не пересказывай пост целиком и не придумывай. Пометки в /…/, ((…)), [OOC] — режиссура для модели, их не выписывай.
Ещё choice — только если в этом посте игрок принимает КРУПНОЕ решение со ставками, которое может аукнуться позже: соврать или скрыть важное, пощадить или сдать кого-то, нарушить обещание, рискнуть собой, уйти, согласиться на сделку, взять вину на себя, выбрать одного вместо другого. {"what":"что она выбрала, 5–14 слов","stake":"чем может аукнуться — кому и как, 5–14 слов","who":["кого коснётся"],"weight":1–3 (3 — меняет жизнь)}. Бытовые выборы (что надеть, съесть, заказать, куда сесть) — не решения: null.
Ответь только JSON: {"items":[{"t":"что, 4–12 слов; реплику — короткой цитатой «…»","to":"кому адресовано — имя, или пусто, если всем"}],"choice":null}`;

const pending = new Map(); // key → Promise

async function extract(u) {
    const chat = A.chatArr();
    const m = chat[u];
    const text = A.plainText(m?.mes || '').trim();
    if (text.length < 25) return { items: [], skip: true };
    let prev = '';
    for (let j = u - 1; j >= 0 && !prev; j--) if (chat[j] && !chat[j].is_system && !chat[j].is_user) prev = A.cut(A.plainText(chat[j].mes), 700);
    const here = (A.worldState().scene?.characters_present || []).map(A.canonName).filter(Boolean);
    const input = [`Игрок пишет за: ${userName()}`, here.length ? `В сцене: ${here.join(', ')}` : '', prev ? `Конец предыдущего поста:\n${prev}` : '', `Пост игрока:\n${A.cut(text, 4000)}`].filter(Boolean).join('\n\n');
    const out = await A.askModel([{ role: 'system', content: SYSTEM }, { role: 'user', content: input }], 700);
    const j = A.extractJson(out);
    const items = (Array.isArray(j?.items) ? j.items : []).map(x => ({ t: String(x?.t || '').trim().slice(0, 140), to: String(x?.to || '').trim().slice(0, 40) })).filter(x => x.t).slice(0, 5);
    return { items, choice: j?.choice && typeof j.choice === 'object' && !Array.isArray(j.choice) ? j.choice : null };
}

/** Начать разбор поста u (если ещё не разобран). Возвращает промис записи. */
export function warm(u) {
    if (!replyOn() || u < 0) return null;
    const key = keyOf(u);
    if (!key) return null;
    const have = M().list[key];
    if (have) return Promise.resolve(have);
    if (pending.has(key)) return pending.get(key);
    const cm = A.chatMeta();
    const p = extract(u).then(r => {
        if (A.chatMeta() !== cm) return null;
        // пропущенное в прошлом ответе — один раз в этот
        const prevKey = Object.keys(M().list).filter(k => parseInt(k) < u).sort((a, b) => parseInt(b) - parseInt(a))[0];
        const prevRec = prevKey ? M().list[prevKey] : null;
        const carry = prevRec ? prevRec.items.filter((x, n) => prevRec.state?.[n] === 'miss' && !x.carry).map(x => ({ ...x, carry: true })).slice(0, 2) : [];
        const rec = { items: [...r.items, ...carry], state: {}, at: Date.now(), skip: !!r.skip };
        M().list[key] = rec;
        // крупное решение со ставками — в «Эхо решений»
        if (r.choice) { try { A.onChoice?.(u, r.choice); } catch (e) { console.warn('[Life] эхо решений', e); } }
        // держать только последние 40 разборов
        const keys = Object.keys(M().list).sort((a, b) => parseInt(a) - parseInt(b));
        for (const k of keys.slice(0, Math.max(0, keys.length - 40))) delete M().list[k];
        A.saveMeta();
        A.paintSoon?.();
        return rec;
    }).catch(e => { console.warn('[Life] не пропусти', e); return null; }).finally(() => pending.delete(key));
    pending.set(key, p);
    return p;
}

/** Перед генерацией: дождаться разбора (не дольше wait сек). */
export async function replyReady(type) {
    if (!replyOn() || !A.hasChat() || ['quiet', 'impersonate', 'continue'].includes(type)) return;
    const u = userIndexFor(type);
    if (u < 0) return;
    const p = warm(u);
    if (!p) return;
    const wait = Math.max(0, Math.min(20, Number(cfg().wait) || 8)) * 1000;
    await Promise.race([p, new Promise(r => setTimeout(r, wait))]);
}

/** Заметка в конец промпта: на что ответить в этом ответе. */
export function replyPrompt(type) {
    if (!replyOn() || !A.hasChat() || type === 'quiet' || type === 'impersonate' || type === 'continue') return '';
    const u = userIndexFor(type);
    if (u < 0) return '';
    const rec = M().list[keyOf(u)];
    if (!rec?.items?.length) return '';
    // свайп/реген ответа — снова всё (кроме снятого руками): новый вариант отвечает заново
    const open = rec.items.map((x, n) => ({ ...x, n })).filter(x => rec.state[x.n] !== 'off');
    if (!open.length) return '';
    const U = A.shortName(userName());
    return `[Не пропусти — в этом ответе отреагируй на то, что было в посте ${U}: словом, делом или взглядом, в характере, не списком и не по порядку; кому адресовано — тот и отвечает:\n${open.map(x => `• ${x.t}${x.to ? ` (${A.shortName(A.canonName(x.to))})` : ''}${x.carry ? ' — с прошлого раза, ещё без ответа' : ''}`).join('\n')}]`;
}

// ───────────── Летописец: на что ответили ─────────────

export function replyChron() {
    if (!replyOn() || !A.hasChat()) return null;
    const i = A.lastAiIndex();
    const u = userIndexBefore(i);
    if (u < 0) return null;
    const rec = M().list[keyOf(u)];
    if (!rec?.items?.length) return null;
    const open = rec.items.map((x, n) => ({ ...x, n: n + 1 })).filter(x => rec.state[x.n - 1] !== 'off');
    if (!open.length) return null;
    return {
        key: '"answered": []',
        rule: '\n\nanswered — номера пунктов из строки «Ждёт ответа», на которые этот пост ответил (словом, делом или взглядом — по смыслу, не дословно): [1, 3]. Ни на что — [].',
        input: `Ждёт ответа: ${open.map(x => `${x.n}) ${x.t}`).join('; ')}`,
        tokens: 40,
    };
}

export function replyAfterPost(i, j) {
    if (!replyOn() || !A.hasChat()) return;
    const u = userIndexBefore(i);
    if (u < 0) return;
    const rec = M().list[keyOf(u)];
    if (!rec?.items?.length || !Array.isArray(j?.answered)) return;
    const got = new Set(j.answered.map(Number).filter(Number.isFinite).map(n => n - 1));
    rec.items.forEach((x, n) => { if (rec.state[n] === 'off') return; rec.state[n] = got.has(n) ? 'ok' : 'miss'; });
    rec.ans = i;
    A.saveMeta();
}

// ───────────── чипы под постом игрока ─────────────

export function paintReply(el, id) {
    const m = A.chatArr()[id];
    const old = el.querySelector(':scope .lf-reply');
    if (!replyOn() || !m?.is_user) { old?.remove(); return; }
    const key = keyOf(id);
    const rec = M().list[key];
    const busy = pending.has(key);
    if (!rec?.items?.length && !busy) { old?.remove(); return; }
    const html = busy && !rec
        ? `<div class="lf-reply busy">${A.icon('eye')}<span>читаю, на что ответить…</span></div>`
        : `<div class="lf-reply">${A.icon('eye')}${rec.items.map((x, n) => {
            const st = rec.state[n] || (rec.ans != null ? 'miss' : 'wait');
            return `<button class="lf-reply-i ${st}" data-act="rp-tog" data-key="${esc(key)}" data-n="${n}" title="${st === 'off' ? 'вернуть' : 'не надо'}">${st === 'ok' ? '✓ ' : st === 'miss' ? '✗ ' : ''}${esc(x.t)}${x.to ? ` <i>· ${esc(A.shortName(A.canonName(x.to)))}</i>` : ''}</button>`;
        }).join('')}</div>`;
    const sig = A.hash(html);
    if (old && old.dataset.sig === sig) return;
    old?.remove();
    const host = el.querySelector('.mes_block') || el;
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const node = tmp.firstElementChild;
    node.dataset.sig = sig;
    const anchor = host.querySelector(':scope > .mes_text');
    if (anchor) anchor.after(node); else host.append(node);
}

export function replyClick(act, el) {
    if (act !== 'rp-tog') return false;
    const rec = M().list[el.dataset.key];
    const n = Number(el.dataset.n);
    if (!rec || !rec.items[n]) return true;
    rec.state[n] = rec.state[n] === 'off' ? (rec.ans != null ? 'miss' : 'wait') : 'off';
    if (rec.state[n] === 'wait') delete rec.state[n];
    A.saveMeta();
    A.updatePrompt();
    A.paintSoon?.();
    return true;
}

/** Что записал твой пост i: на что ждали ответа. */
export function replyRecs(i) {
    if (!replyOn()) return [];
    const rec = M().list[keyOf(i)];
    if (!rec?.items?.length) return [];
    return rec.items.map((x, n) => ({ x, n })).filter(({ n }) => rec.state[n] !== 'off').map(({ x, n }) => ({
        id: `rp:${n}:${x.t}`, g: 'Не пропусти', icon: 'eye', t: `${x.t}${x.to ? ` → ${A.shortName(A.canonName(x.to))}` : ''}`,
        del: () => { rec.state[n] = 'off'; },
    }));
}
