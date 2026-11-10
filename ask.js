// Запрос за JSON. Думающие модели съедают часть токенов на мысли, и длинный ответ обрывается посреди JSON —
// тогда один переспрос с запасом токенов и просьбой писать компактнее. Не вышло и так — ошибка с настоящей
// причиной: оборвался (прибавь токенов), пришёл не JSON (с началом ответа), битый, без нужных полей.

const cutText = (t, n) => { t = String(t ?? ''); return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t; };

/** Почему ответ не годится: { cut: оборвался ли, text: по-русски }. j — что разобралось (или null). */
export function jsonTrouble(out, j) {
    const t = String(out || '').replace(/```(?:json)?/gi, '').trim();
    if (j) return { cut: false, text: 'пришёл без нужных полей' };
    const a = t.indexOf('{');
    if (a < 0) return { cut: false, text: `пришёл не JSON${t ? `: «${cutText(t.replace(/\s+/g, ' '), 60)}»` : ''}` };
    const body = t.slice(a);
    const open = (body.match(/[{[]/g) || []).length;
    const close = (body.match(/[}\]]/g) || []).length;
    const quotes = (body.replace(/\\"/g, '').match(/"/g) || []).length;
    if (open > close || quotes % 2 || !/[}\]]\s*$/.test(body)) return { cut: true, text: `оборвался на полуслове (${body.length} знаков) — не хватило токенов` };
    return { cut: false, text: 'пришёл битый JSON' };
}

/**
 * ask(messages, tokens) → текст; parse(text) → объект или null; base() — токены из настроек Летописца.
 * Возвращает askJson(messages, tokens, { check, what }): токенов — не меньше base(); check(j) — есть ли главное.
 */
export function makeAskJson({ ask, parse, base }) {
    return async function askJson(messages, tokens, { check = null, what = 'ответ' } = {}) {
        const n = Math.max(Number(tokens) || 0, Number(base?.()) || 0);
        const ok = (j) => !!j && (!check || !!check(j));
        const out = await ask(messages, n, what);
        let j = parse(out);
        if (ok(j)) return j;
        const first = jsonTrouble(out, j);
        console.warn(`[Life] ${what}: ${first.text} — переспрашиваю с запасом`);
        const last = messages[messages.length - 1];
        const again = [...messages.slice(0, -1), { ...last, content: `${last.content}\n\n[Прошлый ответ ${first.text}. Ответь заново: строго один JSON по схеме, без пояснений и markdown${first.cut ? '; пиши компактнее, чтобы точно уложиться' : ''}.]` }];
        const out2 = await ask(again, Math.min(Math.round(n * 1.75), 16000), what);
        j = parse(out2);
        if (ok(j)) return j;
        const second = jsonTrouble(out2, j);
        throw new Error(`${what}: ответ ${second.text}${second.cut ? ' и с запасом — прибавь «Токенов на ответ» Летописцу (Мир → ⚙)' : first.text === second.text ? ' дважды — модель не держит формат; помогает запасной профиль (Мир → ⚙)' : ''}`);
    };
}
