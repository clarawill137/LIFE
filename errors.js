// Разбор ошибок: красная плашка таверны → карточка по-русски, что случилось и что делать.
// Идея — из Error Companion (Kitima); тексты и правила свои. Объясняет питомец, если он есть.

import { icon } from './icons.js';

let A = null;
const seen = new Map();

const RULES = [
    {
        id: 'server', re: /could not be saved|check the server connection|csrf token|server cannot be reached|is the server running/i,
        title: 'Таверна не достучалась до своего сервера',
        what: 'Страница не смогла отправить данные серверу ST — последние настройки или сообщение могли не сохраниться.',
        fix: ['Скопируй набранный текст, чтобы не потерять.', 'Обнови страницу — чаще всего этого хватает.', 'Повторяется — в Termius: docker ps и docker logs sillytavern --tail 50.', 'Проверь место на диске: df -h.'],
    },
    {
        id: 'auth', re: /\b40[13]\b|unauthori[sz]ed|invalid.{0,20}(api[ _-]?key|token)|incorrect api key|permission[ _]denied|forbidden|api key not valid/i,
        title: 'Ключ не подходит',
        what: 'Провайдер не принял ключ API или у ключа нет доступа к этой модели.',
        fix: ['Проверь ключ в «Подключении» (вилка сверху).', 'Модель может быть недоступна на твоём тарифе или в регионе.', 'Для Google: включён ли Generative Language API у проекта ключа.'],
    },
    {
        id: 'money', re: /\b402\b|insufficient.{0,12}(credit|balance|fund|quota)|payment required|out of credits|billing/i,
        title: 'Кончились деньги у провайдера',
        what: 'На счёте провайдера (OpenRouter и т. п.) не хватает баланса на этот запрос.',
        fix: ['Пополни баланс у провайдера.', 'Или переключи профиль на другую модель в пульте → Модель.'],
    },
    {
        id: 'rate', re: /\b429\b|rate.?limit|too many requests|resource.?exhausted|quota exceeded|exceeded your current quota/i,
        title: 'Слишком много запросов',
        what: 'Провайдер притормозил: запросов подряд слишком много или кончилась квота на сегодня.',
        fix: ['Подожди минуту и повтори.', 'Летописец, детали, слухи, Конвейер тоже тратят запросы — лишних агентов можно выключить в пульте.', 'Бесплатная квота Gemini сбрасывается раз в сутки.'],
    },
    {
        id: 'block', re: /prohibited.?content|safety|blocked|content.?filter|moderation|flagged|recitation|finish.?reason.{0,6}(other|safety|content)/i,
        title: 'Ответ съел фильтр',
        what: 'Провайдер заблокировал ответ модерацией — у Gemini так бывает на откровенных или жёстких сценах.',
        fix: ['Свайпни или перегенерируй — часто проходит со второго раза.', 'Чуть смягчи формулировку последнего поста.', 'Для таких сцен держи отдельный профиль с другой моделью.'],
    },
    {
        id: 'context', re: /context.{0,10}(length|window|limit)|maximum context|too many tokens|token limit|prompt is too long|reduce the length|input is too long/i,
        title: 'Промпт не влезает в модель',
        what: 'Всё, что уходит модели (чат, лорбуки, заметки расширений), больше её окна.',
        fix: ['Уменьши Context Size в настройках ответа.', 'Выключи лишние лорбуки и расширения, которые добавляют текст в промпт.'],
    },
    {
        id: 'busy', re: /overloaded|\b50[234]\b|\b529\b|bad gateway|service unavailable|gateway time|upstream|timed? ?out|timeout|internal server error|\b500\b/i,
        title: 'Модель перегружена или не успела',
        what: 'Проблема на стороне провайдера: сервер занят или ответ не пришёл вовремя.',
        fix: ['Повтори через минуту.', 'Если долго — переключись на другой профиль модели.'],
    },
    {
        id: 'empty', re: /empty (response|reply|message)|got an empty|no (response|candidates|content)|returned nothing/i,
        title: 'Пустой ответ',
        what: 'Модель ничего не прислала — часто это тихий фильтр или обрыв.',
        fix: ['Свайпни или перегенерируй.', 'Повторяется — попробуй другой профиль или уменьши контекст.'],
    },
    {
        id: 'model', re: /model.{0,30}(not found|does not exist|is not available|not supported)|no such model|unknown model|\b404\b/i,
        title: 'Такой модели нет',
        what: 'Модель с этим именем не нашлась — её переименовали, убрали или выбрана не та.',
        fix: ['Выбери модель заново в «Подключении».', 'На OpenRouter названия моделей иногда меняются.'],
    },
    {
        id: 'net', re: /failed to fetch|network ?error|econnreset|enotfound|econnrefused|socket hang up|fetch failed|proxy/i,
        title: 'Нет связи с провайдером',
        what: 'Сервер таверны не смог достучаться до провайдера модели.',
        fix: ['Повтори через минуту.', 'Проверь интернет на сервере и прокси, если он настроен.'],
    },
    {
        id: 'bad', re: /\b400\b|bad request|invalid (request|argument|parameter)|unsupported (parameter|value)/i,
        title: 'Провайдер не понял запрос',
        what: 'Обычно в пресете включено то, что эта модель не поддерживает.',
        fix: ['Попробуй другой пресет или выключи лишние параметры (top_k, reasoning, стоп-слова).', 'Обнови таверну, если давно не обновляла.'],
    },
];

function plain(v) {
    const d = document.createElement('div');
    d.innerHTML = String(v ?? '');
    return d.textContent || '';
}

export function initErrors(api) {
    A = api;
    const t = globalThis.toastr;
    if (!t || t.__lifeErr) return;
    const wrap = (fn) => function (message, title, ...rest) {
        const out = fn.call(this, message, title, ...rest);
        try { if (A.settings().errHelp !== false) explain(`${plain(title)} ${plain(message)}`); } catch (e) { console.warn('[Life] разбор ошибки', e); }
        return out;
    };
    t.error = wrap(t.error);
    t.__lifeErr = true;
}

function explain(text) {
    if (!text.trim() || /✦/.test(text)) return; // свои тосты Life не разбираем
    const rule = RULES.find(r => r.re.test(text));
    if (!rule) return;
    const now = Date.now();
    if (now - (seen.get(rule.id) || 0) < 30000) return;
    seen.set(rule.id, now);
    show(rule, text);
}

function companion() {
    const pets = A.chatMeta()?.pets || [];
    const p = pets.find(x => x.img) || null;
    return p ? `<img src="${A.esc(p.img)}" alt="">` : icon('paw');
}

function show(rule, raw) {
    document.getElementById('lf-err')?.remove();
    const el = document.createElement('div');
    el.id = 'lf-err';
    el.innerHTML = `<div class="lf-err-card" role="alert">
        <span class="lf-err-ava">${companion()}</span>
        <div class="lf-err-t">
            <b>${A.esc(rule.title)}</b>
            <p>${A.esc(rule.what)}</p>
            <ol>${rule.fix.map(f => `<li>${A.esc(f)}</li>`).join('')}</ol>
            <details><summary>Текст ошибки</summary><code>${A.esc(raw.trim().slice(0, 600))}</code></details>
        </div>
        <button class="lf-err-x" aria-label="Закрыть">${icon('x')}</button>
    </div>`;
    el.addEventListener('click', (e) => { if (e.target.closest('.lf-err-x')) el.remove(); });
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
    setTimeout(() => { if (el.isConnected && !el.matches(':hover')) el.classList.remove('on'); setTimeout(() => el.remove(), 400); }, 45000);
}
