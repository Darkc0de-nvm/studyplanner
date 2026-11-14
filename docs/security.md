# Безпека StudyPlanner

Документ описує загрози, вжиті заходи та спосіб їх перевірки для серверної частини StudyPlanner (Фаза 3). Статус `PASS` означає, що поведінка підтверджена автоматичним тестом або відтвореною командою на production-like сервері.

## 1. Підсумок

| Показник | Результат |
|---|---|
| `npm audit` (усі залежності) | 0 уразливостей |
| `npm audit --omit=dev` | 0 уразливостей |
| Секрети в робочому дереві та історії | не знайдено (`npm run secret-scan`) |
| Знайдені серйозні/critical проблеми безпеки | не залишилось; одна відома межа задокументована нижче |
| Покриття тестами рядків `server/src` | 98.32 % |

Перевірені версії: Node.js 22+, Express 4.21, helmet 8, Zod 4.6.7, `pg` 8.13, argon2 0.41.

## 2. Матриця загроз

Дії зі зміни пароля та видалення акаунта доступні авторизованому користувачу в налаштуваннях акаунта `account.html`; сторінка використовує спільну перевірку сесії з поверненням на запитаний шлях після входу.

| Загроза | Захід | Як перевірено | Статус |
|---|---|---|---|
| Міжсайтовий скриптинг (XSS) | Усі відповіді API — JSON; клієнт вставляє дані через `textContent`/`createElement`, без `innerHTML`. CSP: `script-src 'self'`, `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'self'`. | `tests/auth.test.js` (XSS-payload у `name` зберігається як текст); `tests/security-headers.test.js`; ручна перевірка заголовків | PASS |
| Вставка HTML/фреймів (clickjacking) | `frame-ancestors 'none'`, `frame-src 'none'`, `X-Frame-Options: DENY` | `tests/security-headers.test.js`; `Invoke-WebRequest http://127.0.0.1:3200/` | PASS |
| CSRF | Для всіх state-changing запитів: `Content-Type: application/json` + перевірка `Origin` проти `Host`; cookie `SameSite=Lax` | `tests/origin-check.test.js`, `tests/auth.test.js` (cross-origin → 403, malformed Origin → 400) | PASS |
| Викрадення сесії через cookie | `HttpOnly`, `SameSite=Lax`, `Secure` у production (`COOKIE_SECURE=auto`), підпис `<uuid>.<HMAC-SHA256>` з `timingSafeEqual` | `tests/session-cookie.test.js`, `tests/auth.test.js` | PASS |
| Фіксація сесії | Під час логіну створюється новий серверний session id; старий cookie замінюється | `tests/auth.test.js`: «creates a new session id on login (session fixation defense)» | PASS |
| Незавершений вихід | `POST /api/auth/logout` видаляє рядок із `sessions` і очищає cookie; повторне використання старої cookie → `401` | `tests/auth.test.js`: «session is invalidated after logout» | PASS |
| Перебір пароля/логіна | `express-rate-limit`: auth-ліміт на `register`, `login`, видалення акаунта та зміну пароля; загальний API-ліміт також діє для захищених маршрутів | `tests/rate-limit.test.js`, `tests/account.test.js` | PASS |
| Повторне підтвердження чутливих дій | Зміна пароля й видалення акаунта вимагають поточний пароль та використовують auth rate limiter; змінений пароль інвалідує інші сесії | `tests/account.test.js` | PASS |
| Перелік користувачів через login | Однакове `401 INVALID_CREDENTIALS` для невідомої пошти й хибного пароля; для неіснуючої пошти виконується dummy Argon2id-хеш, щоб вирівняти час | `tests/auth.test.js`: два тести «no user enumeration» | PASS |
| Перелік користувачів через реєстрацію | Нейтральне `409 REGISTRATION_FAILED` замість «email вже зайнятий» | `tests/auth.test.js`: «returns 409 when email already registered» | PASS (з межею, див. §4) |
| Підбір/витік пароля | Argon2id (`memoryCost` 64 MiB, `timeCost` 3, `parallelism` 1); пароль ніколи не логується й не повертається | `src/services/auth.js`; `tests/auth.test.js` | PASS |
| SQL-ін'єкції | Лише параметризовані запити `$1, $2, ...`; немає конкатенації користувацьких значень | `tests/tasks.test.js`, `tests/disciplines.test.js` (payload `' OR 1=1; --`) | PASS |
| Надмірне навантаження / великі тіла | `express.json({ limit: '16kb' })`; `413` для завеликого тіла; Zod `.strict()` відхиляє зайві поля | `tests/auth.test.js`, `tests/tasks.test.js` | PASS |
| Некоректні ідентифікатори та дати | UUID-параметри валідовуються до SQL; Zod-схеми перевіряють реальність дати; помилки PG мапляться у 400/404, а не 500 | `tests/db-failures.test.js`, `tests/tasks.test.js` | PASS |
| Витік внутрішніх деталей у помилках | Централізований `errorHandler`: у production — узагальнене повідомлення, деталі лише в логах без тіла запиту | `tests/error-handler.test.js` | PASS |
| Небезпечні заголовки браузера | `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` | `tests/security-headers.test.js`; ручний запит до `:3200` | PASS |
| Підміна MIME та кешування | Статика віддається з `nosniff`; HTML — `Cache-Control: no-cache, no-store, must-revalidate`; хешовані `css/js/assets` — `max-age=1y` | `tests/static.test.js`; заголовки на `:3200` | PASS |
| Секрети в репозиторії | `.env` у `.gitignore`; `.env.example` містить лише заглушки; `scripts/secret-scan.js` сканує робоче дерево й доступну історію Git | `npm run secret-scan` → `PASS` | PASS |
| Залежності з відомими CVE | Оновлено Zod 4.6.7, Vitest 5.1.0, coverage-v8 5.1.0; регресійний аудит у CI (report-only) | `npm audit`, `npm audit --omit=dev` → 0 | PASS |

## 3. Фактичні заголовки

Відповідь `GET http://127.0.0.1:3200/` (production-like сервер):

```text
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self';form-action 'self';frame-ancestors 'none';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self';upgrade-insecure-requests;connect-src 'self';frame-src 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
```

Cookie після успішного логіну (локальний запуск із `COOKIE_SECURE=false`):

```text
sp_session=<uuid>.<hmac>; Path=/; Expires=...; HttpOnly; SameSite=Lax
```

У production `COOKIE_SECURE=auto` додає `Secure`, а `TRUST_PROXY=1` вмикає коректну роботу за TLS-проксі. HSTS увімкнений helmet-ом завжди; на локальному HTTP він ігнорується браузером, а на реальному HTTPS-домені діє.

## 4. Відомі межі

1. **Залишковий канал переліку користувачів у реєстрації.** Нейтральний текст і код `409 REGISTRATION_FAILED` приховують причину, але різниця статусів `201` (створено) і `409` (уже існує) все одно дозволяє перевірити наявність акаунта. Повне усунення потребує підтвердження email і однакової відповіді на обидва випадки; у межах Lab 5 це задокументовано як свідомий компроміс.
2. **Rate limit зберігається в пам'яті процесу.** Для одного інстансу це коректно; за горизонтального масштабування потрібен спільний store (наприклад, Redis). Для навчального single-origin деплою це прийнятно.
3. **CSP без nonce/hash.** Політика `script-src 'self'` забороняє inline-скрипти; усі скрипти підключені як `defer`-файли. Це простіше й безпечніше за nonce для статичного клієнта без збірки.
4. **HTTPS поза застосунком.** TLS термінується на хостингу (Render/проксі); застосунок лише довіряє проксі та виставляє HSTS. Локальний production-like запуск іде по HTTP, тому `Secure` вимкнено лише для нього.

## 5. Як відтворити

```powershell
cd server
npm audit
npm audit --omit=dev
npm run secret-scan
npm test -- tests/security-headers.test.js tests/auth.test.js tests/origin-check.test.js tests/session-cookie.test.js
```

Сканер розпізнає лише явні шаблони для документаційних PostgreSQL URL (`user:pass` і `<user>:<password>`). Інші URL із credential-формою залишаються помилками; перевірка робочого дерева й Git-історії не вимикається.

Ручна перевірка заголовків і cookie:

```powershell
$r = Invoke-WebRequest http://127.0.0.1:3200/ -UseBasicParsing
$r.Headers['Content-Security-Policy']
$r.Headers['X-Frame-Options']
```

## 6. Пов'язані файли

- `server/src/app.js` — helmet/CSP, ліміт тіла, маршрути.
- `server/src/middleware/originCheck.js` — CSRF-захист.
- `server/src/middleware/rateLimiters.js` — ліміти.
- `server/src/utils/sessionCookie.js` — підписана cookie та її прапорці.
- `server/src/services/auth.js` — Argon2id, нейтральні помилки, dummy-хеш.
- `server/scripts/secret-scan.js` — сканер секретів.
- `server/tests/security-headers.test.js`, `auth.test.js`, `origin-check.test.js`, `session-cookie.test.js`, `rate-limit.test.js`.
