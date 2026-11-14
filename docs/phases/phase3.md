# Звіт про виконання Фази 3: безпека, доступність, швидкодія та CI

**Дата завершення:** 13.11.2026  
**Гілка:** `lab5-fullstack`  
**Обсяг:** аудит безпеки, axe-core і keyboard-only перевірки, Lighthouse до/після, GitHub Actions, фінальні прогони.

## 1. Підсумок

Фазу 3 завершено. Сервер пройшов аудит залежностей і заголовків, клієнт — повний axe-аудит на 60 комбінаціях сторінок/станів і keyboard-only сценарії, а Lighthouse на production-like сервері показує **100/100/100/100** на всіх восьми прогонах, крім `tasks.html` mobile (Performance 99) і CLS 0.030 на desktop-версії списку.

Ключові результати:

- `npm audit` і `npm audit --omit=dev`: **0 уразливостей**;
- серверні тести: **167/167**, покриття рядків **98.59 %**, гілок **96.46 %**, функцій **100 %**;
- axe-core: **60/60**, 0 `serious`/`critical` у Chromium на 1440 і 390 px;
- keyboard-only: **8/8**; горизонтального скролу на 720 px немає;
- візуальна база: **118/118** у Chromium і Firefox після навмисних a11y-змін;
- Lighthouse: Performance 97–100, Accessibility 100, Best Practices 100, SEO 100;
- `npm run secret-scan`: **PASS**; ESLint: **0 помилок**; клієнтський валідатор: **23 HTML + 9 CSS** без помилок.

## 2. Етапи

### S1. Залежності та базовий аудит

- `zod` оновлено до **4.6.7** (major): у коді та тестах використовується `err.issues`, схеми переведено на новий формат повідомлень, додано `src/schemas/messages.js`; поведінка валідації покрита `tests/schema-messages.test.js`.
- `vitest` і `@vitest/coverage-v8` оновлено до **5.1.0** (major): видалено застарілі `poolOptions`, зафіксовано `fileParallelism: false`, `maxWorkers: 1`, `minWorkers: 1`, бо API-тести ділять одну PostgreSQL-базу.
- Додано `@axe-core/playwright` і `lighthouse` як dev-залежності; причина кожної — автоматизація a11y та вимірювання продуктивності.
- `npm audit` після оновлень — 0 уразливостей (повний і production-only).

### S2. Безпека

- CSP посилено: `frame-ancestors 'none'`, `frame-src 'none'`, `script-src-attr 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`; `frameguard: deny`.
- Реєстрація повертає нейтральний `409 REGISTRATION_FAILED` замість повідомлення про зайнятий email.
- Додано `tests/security-headers.test.js`: перевіряються CSP, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS і ті самі заголовки на API.
- Перевірено cookie: `HttpOnly`, `SameSite=Lax`, `Secure` у production, підпис HMAC і ротацію session id під час логіну.
- `server/scripts/secret-scan.js` сканує робоче дерево й доступну історію Git; `npm run secret-scan` → PASS.
- Деталі та матриця загроз — у [`docs/security.md`](../security.md).

### S3. Доступність

- Створено `server/e2e/page-fixtures.js` — спільні сторінки, стани й вхід у демо-акаунт.
- `a11y.spec.js`: 30 сторінок/станів × 2 ширини = 60 тестів; теги WCAG 2.0/2.1/2.2 A+AA; падіння лише на `serious`/`critical`.
- `keyboard.spec.js`: skip-link, вхід, діалог + Escape, меню користувача, календар, редагування завдання, підтвердження видалення, 200 % zoom (720 px).
- Виправлено контраст заповнених бейджів (`--discipline-*-fill`, білий текст), темніший текст `.alert--error`, доступні імена меню користувача та `label-content-name-mismatch` у календарі через `.visually-hidden`-опис.
- Візуальні еталони оновлено лише для навмисних змін контрасту; повторний прогін стабільний.
- Деталі — у [`docs/accessibility.md`](../accessibility.md).

### S4. Швидкодія

- Піднято production-like сервер: `NODE_ENV=production`, порт `3200`, e2e-база `5433`, `DATABASE_SSL=false`, `COOKIE_SECURE=false`.
- Знято Lighthouse mobile і desktop для landing, login, tasks, calendar до та після змін.
- Виправлено: `404` на `/favicon.ico` (Best Practices 96 → 100), відсутні meta-описи (SEO 90 → 100), CLS календаря (0.110 → 0.005) через резерв висоти порожньої сітки, preload кириличного й латинського шрифтів.
- `EXPLAIN ANALYZE` підтвердив використання `idx_tasks_user_deadline`, `idx_disciplines_user` і `sessions_pkey`; послідовних сканувань немає.
- Сирі звіти — `server/perf/before-*.json`, `after-*.json`; підсумок — у [`docs/performance.md`](../performance.md).

### S5. CI та фінальні перевірки

- `.github/workflows/ci.yml`: `npm ci`, ESLint, валідатор клієнта, API-тести з PostgreSQL service на 5433, Playwright Chromium+Firefox (без локальних візуальних еталонів), secret scan, `npm audit` у режимі report-only.
- `server/scripts/validate-client.js` — офлайн-валідатор: doctype, `lang`, meta, унікальні id, локальні посилання, inline-обробники, `defer`, `alt`, баланс дужок і `url()` у CSS.
- У README додано badge CI.
- Фінально прогнано unit-тести, ESLint, e2e, axe, keyboard, secret scan, `npm audit` і Lighthouse.

## 3. Перевірки

| Перевірка | Команда | Результат |
|---|---|---|
| API-тести + покриття | `npm test` | 167/167; lines 98.59 %, branches 96.46 %, functions 100 % |
| ESLint | `npm run lint` | 0 помилок, 0 попереджень |
| E2E (Chromium + Firefox) | `npm run e2e` | 234 passed, 60 skipped (a11y лише Chromium); візуальні — 118/118 |
| axe-core | `npx playwright test e2e/specs/a11y.spec.js --project=chromium` | 60/60, 0 serious/critical |
| Keyboard-only | `npx playwright test e2e/specs/keyboard.spec.js` | 8/8 у Chromium і 8/8 у Firefox |
| Валідатор клієнта | `npm run validate:client` | 23 HTML + 9 CSS, 0 помилок |
| Секрети | `npm run secret-scan` | PASS |
| Залежності | `npm audit` / `npm audit --omit=dev` | 0 / 0 |
| Lighthouse | `npx lighthouse ...` (8 прогонів) | perf 97–100, a11y 100, BP 100, SEO 100 |

Lighthouse-деталі:

| Сторінка | Mobile | Desktop |
|---|---|---|
| `/` | 100 · LCP 1061 ms · CLS 0.000 | 100 · LCP 257 ms · CLS 0.000 |
| `/login.html` | 100 · LCP 1061 ms · CLS 0.000 | 100 · LCP 252 ms · CLS 0.000 |
| `/tasks.html` | 99 · LCP 2062 ms · CLS 0.005 | 100 · LCP 484 ms · CLS 0.030 |
| `/calendar.html` | 100 · LCP 1061 ms · CLS 0.005 | 100 · LCP 297 ms · CLS 0.033 |

## 4. Відомі обмеження

1. Нейтральна реєстрація все одно відрізняється статусом `201`/`409`, тому наявність акаунта можна перевірити; повне усунення потребує email verification.
2. Rate limit зберігається в пам'яті процесу — для кількох інстансів потрібен спільний store.
3. axe-аудит виконується лише в Chromium; Firefox покриває поведінкові e2e-сценарії.
4. Живий скрінрідер (NVDA/VoiceOver) не тестувався; доступні імена й `aria-live` перевірені через axe/DOM.
5. Візуальні еталони локальні (`*-snapshots/` ігноруються git) і прив'язані до `win32`; у CI візуальні тести виключені.
6. Lighthouse-числа локальні, без CDN і реального TLS; LCP має природну варіативність (landing mobile 1061–1522 ms).
7. `docs/security.md`, `docs/accessibility.md`, `docs/performance.md` і `docs/ai-log.md` лежать у `docs/`, який ігнорується git; у репозиторій потрапляє лише цей звіт у `docs/phases/`.

## 5. Файли

Основні зміни Фази 3:

- **Безпека:** `server/src/app.js`, `server/src/services/auth.js`, `server/src/schemas/*.js`, `server/src/middleware/errorHandler.js`, `server/scripts/secret-scan.js`, `server/tests/security-headers.test.js`, `server/tests/auth.test.js`, `server/tests/schema-messages.test.js`.
- **Доступність:** `server/e2e/page-fixtures.js`, `server/e2e/specs/a11y.spec.js`, `server/e2e/specs/keyboard.spec.js`, `client/js/calendar.js`, `client/tasks.html`, `client/calendar.html`, `client/states.html`, `client/css/tokens.css`, `client/css/components.css`, `client/css/pages/app.css`.
- **Швидкодія:** `client/favicon.svg`, meta-описи та `preload` у `client/*.html`, `server/perf/*`.
- **Інфраструктура:** `.github/workflows/ci.yml`, `server/scripts/validate-client.js`, `server/package.json`, `server/package-lock.json`, `server/vitest.config.mjs`, `README.md`.
- **Документація:** `docs/phases/phase3.md`; локально (поза git) — `docs/security.md`, `docs/accessibility.md`, `docs/performance.md`, `docs/ai-log.md`.

Коміти, staging, push, merge і теги не виконувалися — їх робить користувач.

Наступний етап — production-розгортання. Його статус і критерії готовності зафіксовані в [`phase4.md`](phase4.md), а інструкція з налаштування та відкату — у [`../deployment.md`](../deployment.md).
