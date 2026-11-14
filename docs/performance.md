# Швидкодія StudyPlanner

Документ фіксує вимірювання Lighthouse до і після оптимізацій Фази 3, перевірку індексів PostgreSQL через `EXPLAIN` та відтворювані команди. Аудит виконувався на production-like сервері (`NODE_ENV=production`, порт `3200`, окрема e2e-база на `5433`, `DATABASE_SSL=false`) у headless Chrome.

## 1. Підсумок

| Сторінка | Профіль | Performance | LCP | CLS | TBT | Transfer |
|---|---|---:|---:|---:|---:|---:|
| `/` | mobile | 100 | 1061 ms | 0.000 | 0 ms | 71 KB |
| `/` | desktop | 100 | 257 ms | 0.000 | 0 ms | 71 KB |
| `/login.html` | mobile | 100 | 1061 ms | 0.000 | 0 ms | 105 KB |
| `/login.html` | desktop | 100 | 252 ms | 0.000 | 0 ms | 105 KB |
| `/tasks.html` | mobile | 99 | 2062 ms | 0.005 | 0 ms | 121 KB |
| `/tasks.html` | desktop | 100 | 484 ms | 0.030 | 0 ms | 121 KB |
| `/calendar.html` | mobile | 100 | 1061 ms | 0.005 | 6 ms | 121 KB |
| `/calendar.html` | desktop | 100 | 297 ms | 0.033 | 0 ms | 121 KB |

Усі сторінки: **accessibility 100, best practices 100, SEO 100**. Єдиний показник поза «good» — CLS 0.030 на desktop-версії `tasks.html` (поріг «good» — 0.1, тобто це все ще добра зона). Mobile LCP для `tasks.html` — 2062 ms; це найдовший LCP серед сторінок і пояснений нижче.

## 2. До / після

Вимірювання «до» зроблено на тому самому сервері до оптимізацій; «після» — після виправлень. Формат: `Performance / Best practices / SEO`, LCP у мс, CLS, TBT у мс, transfer у KB.

| Сторінка | Профіль | До | Після |
|---|---|---|---|
| `/` | mobile | 100 / 96 / 100 · 1063 ms · 0.001 · 0 ms · 71 KB | **100 / 100 / 100** · 1061 ms · 0.000 · 0 ms · 71 KB |
| `/` | desktop | 100 / 96 / 100 · 251 ms · 0.005 · 0 ms · 71 KB | **100 / 100 / 100** · 257 ms · 0.000 · 0 ms · 71 KB |
| `/login.html` | mobile | 100 / 96 / 100 · 1061 ms · 0.000 · 0 ms · 105 KB | **100 / 100 / 100** · 1061 ms · 0.000 · 0 ms · 105 KB |
| `/login.html` | desktop | 100 / 96 / 100 · 253 ms · 0.000 · 0 ms · 105 KB | **100 / 100 / 100** · 252 ms · 0.000 · 0 ms · 105 KB |
| `/tasks.html` | mobile | 99 / 96 / **90** · 1968 ms · 0.005 · 0 ms · 122 KB | **99 / 100 / 100** · 2062 ms · 0.005 · 0 ms · 121 KB |
| `/tasks.html` | desktop | 100 / 96 / **90** · 473 ms · 0.035 · 0 ms · 122 KB | **100 / 100 / 100** · 484 ms · 0.030 · 0 ms · 121 KB |
| `/calendar.html` | mobile | 97 / 96 / **90** · 1061 ms · **0.110** · 58 ms · 122 KB | **100 / 100 / 100** · 1061 ms · **0.005** · 6 ms · 121 KB |
| `/calendar.html` | desktop | 100 / 96 / **90** · 290 ms · 0.048 · 0 ms · 122 KB | **100 / 100 / 100** · 297 ms · 0.033 · 0 ms · 121 KB |

Додатково: `accessibility` був 100 і до, і після на всіх восьми прогонах.

## 3. Що оптимізовано

1. **Best practices 96 → 100.** Браузер отримував `404` на `/favicon.ico` і писав це в консоль. Додано `client/favicon.svg` і `<link rel="icon" type="image/svg+xml">` на всі 23 HTML-сторінки.
2. **SEO 90 → 100 на `tasks.html` і `calendar.html`.** Бракувало `<meta name="description">`; мета-описи додано на всі сторінки (включно з `404`, `500`, `offline`, `states`).
3. **CLS 0.110 → 0.005 на мобільному календарі.** Сітка місяця рендериться deferred-скриптом після першого фарбування, тому легенда й кнопка «Додати» спочатку стояли вище. Додано резерв висоти для порожньої сітки:
   ```css
   .calendar-grid:empty { min-block-size: 18rem; }          /* 6 рядків × 3rem */
   @media (min-width: 48rem) { .calendar-grid:empty { min-block-size: 45rem; } }
   ```
   Правило діє лише доти, доки сітка порожня, тому фінальний макет і візуальні еталони не змінилися.
4. **Завантаження шрифтів.** У `<head>` додано `preload` для `geist-cyrillic` і `geist-latin` (`font/woff2`, `crossorigin`); у `@font-face` уже стоїть `font-display: swap`.
5. **Кешування та стиснення.** Express `compression()` віддає gzip/brotli; HTML — `no-cache, no-store, must-revalidate`, а `css/js/assets` — `max-age=1y` з ETag. Це зменшує повторні завантаження без ризику застрягти на старому HTML.
6. **Менший обсяг клієнта.** Жодних фреймворків і бандлера: лише 9 CSS-файлів і 6 JS-модулів; шрифти — лише потрібні підмножини Geist. Transfer на landing — 71 KB, на застосункових сторінках — 105–121 KB.
7. **API та БД.** Список завдань віддає лише потрібні поля, без вкладених дублювань; головні запити використовують індекси (див. §4).

## 4. Індекси PostgreSQL (`EXPLAIN ANALYZE`)

Головний запит списку завдань (демо-акаунт, 7 завдань):

```text
Incremental Sort  (cost=16.40..16.44 rows=2 width=279) (actual time=0.114..0.114 rows=7 loops=1)
  Sort Key: t.deadline, t.created_at
  Presorted Key: t.deadline
  ->  Nested Loop  (cost=0.29..16.39 rows=1 width=279) (actual time=0.043..0.052 rows=7 loops=1)
        ->  Index Scan using idx_tasks_user_deadline on tasks t  (actual time=0.011..0.012 rows=7 loops=1)
              Index Cond: (user_id = '...'::uuid)
        ->  Index Only Scan using disciplines_pkey on disciplines d  (actual time=0.004..0.004 rows=1 loops=7)
              Index Cond: (id = t.discipline_id)
Execution Time: 0.185 ms
```

Дисципліни:

```text
Sort  (cost=8.18..8.18 rows=1 width=252) (actual time=0.041..0.042 rows=3 loops=1)
  ->  Index Scan using idx_disciplines_user on disciplines  (actual time=0.010..0.011 rows=3 loops=1)
        Index Cond: (user_id = '...'::uuid)
Execution Time: 0.061 ms
```

Сесія за id:

```text
Index Scan using sessions_pkey on sessions  (actual time=0.011..0.011 rows=0 loops=1)
  Index Cond: (id = '00000000-0000-0000-0000-000000000000'::uuid)
Execution Time: 0.022 ms
```

Висновок: послідовного сканування немає; `idx_tasks_user_deadline` покриває фільтр за користувачем і сортування за дедлайном, `idx_disciplines_user` — вибірку дисциплін, `sessions_pkey` — перевірку сесії на кожен захищений запит. Додаткові індекси `idx_tasks_user_done` і `idx_tasks_discipline_id` використовуються фільтрами та каскадними перевірками.

## 5. Відомі обмеження

1. **Mobile LCP `tasks.html` — 2062 ms.** Сторінка чекає на `/api/auth/me` і `/api/tasks` перед відображенням карток; на мобільному профілі Lighthouse додає затримку мережі. Це прийнятно для навчального проєкту, але для подальшого покращення варто віддавати скелетон списку й кешувати відповідь на клієнті.
2. **Desktop CLS `tasks.html` — 0.030.** Частина зсуву припадає на пізню появу імені користувача в шапці та завантаження шрифту. Резерв висоти для шапки можливий, але ускладнює розмітку; показник у «good»-зоні.
3. **Вимірювання локальні.** Lighthouse запускався на локальному production-like сервері без CDN і реального TLS. На хостингу числа можуть відрізнятися через холодний старт, мережу та сусідні процеси.
4. **Варіативність LCP.** Повторні прогони landing mobile дали 1061–1522 ms; у таблиці наведено типовий результат. Для стабільних висновків потрібно усереднювати 3–5 прогонів.
5. **Аудит із сесією.** `tasks.html` і `calendar.html` перевірялися з cookie демо-акаунта через `--extra-headers`; без сесії це сторінки входу, а не застосунку.

## 6. Як відтворити

```powershell
cd server
$env:NODE_ENV='production'; $env:PORT='3200'
$env:DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5433/studyplanner_e2e'
$env:SESSION_SECRET='perf-secret-that-is-at-least-32-bytes-long!!'
$env:COOKIE_SECURE='false'; $env:DATABASE_SSL='false'
node src/index.js
```

В іншому терміналі:

```powershell
cd server
$env:CHROME_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npx lighthouse http://127.0.0.1:3200/ --output=json --output-path=perf/after-landing-mobile.json `
  --chrome-flags="--headless=new --no-sandbox" --quiet `
  --only-categories=performance,accessibility,best-practices,seo
```

Для приватних сторінок додайте `--extra-headers=perf/headers.json` (файл із cookie `sp_session`, який не комітиться) і `--preset=desktop` для десктопного профілю.

Сирі звіти: `server/perf/before-*.json` і `server/perf/after-*.json`; `server/perf/explain.js` відтворює `EXPLAIN ANALYZE`.

## 7. Пов'язані файли

- `client/favicon.svg`, meta-описи та `preload` у `client/*.html`.
- `client/css/pages/app.css` — резерв висоти календаря.
- `server/src/app.js` — `compression()`, helmet, статика.
- `server/src/static.js` — Cache-Control для HTML і хешованих ресурсів.
- `server/src/db/migrations/*.sql` — індекси.
- `server/perf/` — сирі Lighthouse-звіти, заголовки, PID і `explain.js`.
