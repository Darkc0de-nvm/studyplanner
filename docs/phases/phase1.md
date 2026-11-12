# Звіт про виконання Фази 1: Серверний каркас, БД, REST API та тести

## 1. Що було виконано

У межах Фази 1 реалізовано повноцінний бекенд для навчального проекту StudyPlanner (Лабораторна робота №5) без внесення змін до існуючого клієнтського коду (відповідно до вимог ізольованого поетапного переходу):

1. **Контейнеризація та локальні бази даних (Docker):**
   - Створено `docker-compose.yml` з двома незалежними інстансами PostgreSQL 16:
     - `db` (`studyplanner_db`, порт `5432`) для локальної розробки з персистентним томом `pgdata`.
     - `db_test` (`studyplanner_db_test`, порт `5433`) для інтеграційних тестів із розміщенням даних у `tmpfs` для максимальної швидкодії.

2. **Керування конфігурацією та безпека оточення:**
   - Створено шаблон змінних оточення `server/.env.example` та локальний `.env` (включений у `.gitignore`).
   - Реалізовано модуль `src/config.js` із жорсткою валідацією параметрів через Zod при запуску сервера (fail-fast підхід).

3. **База даних, міграції та початкове наповнення (Seed):**
   - Налаштовано пул з'єднань `pg.Pool` у `src/db/pool.js` з автовизначенням SSL для хмарних сервісів (Neon/Render).
   - Реалізовано чисті SQL-міграції (`src/db/migrations/`):
     - `001_create_extensions.sql`: розширення `pgcrypto` для генерації UUID.
     - `002_create_users.sql`: таблиця користувачів з унікальними email та хешами паролів.
     - `003_create_sessions.sql`: таблиця серверних сесій із терміном дії та індексами.
     - `004_create_disciplines.sql`: таблиця дисциплін із кольоровими індексами та регістронезалежною унікальністю назв у межах користувача.
     - `005_create_tasks.sql`: таблиця завдань з зовнішніми ключами (`ON DELETE CASCADE` для користувача, `RESTRICT` для дисципліни), чек-констрейнтами та B-Tree індексами для сортування за дедлайном.
   - Створено утиліту виконання міграцій `src/db/migrate.js` з підтримкою прапорця `--status`.
   - Розроблено скрипт початкового наповнення `src/db/seed.js`, який створює демо-користувача, 3 дисципліни та 7 тестових завдань (із дедлайнами, еквівалентними зміщенням з Лабораторної роботи №4).

4. **Базовий рівень безпеки (Security Baseline):**
   - Паролі хешуються за допомогою алгоритму `argon2id` (v0.41+ з prebuilt бінарними файлами для Windows x64).
   - Серверні сесії з кукі `sp_session` (`HttpOnly`, `SameSite=Lax`, `Secure` у продакшені). Захист від session fixation через ротацію ідентифікатора сесії при вході.
   - Захист від CSRF реалізовано через комбінацію: `SameSite=Lax` кукі + обов'язковий заголовок `Content-Type: application/json` + перевірка співпадіння заголовків `Origin` та `Host` для мутуючих запитів (`src/middleware/originCheck.js`).
   - Захист від ін'єкцій: виключно параметризовані SQL-запити (`$1, $2, ...`).
   - Обмеження розміру тіла запиту: `express.json({ limit: '16kb' })`.
   - Обмеження частоти запитів: `express-rate-limit` (10 запитів/хв для автентифікації, 100 запитів/хв для API).
   - Заголовки безпеки: налаштовано `helmet` із конфігурацією CSP (`default-src 'self'`).

5. **REST API (Маршрути, Контролери, Сервіси, Схеми):**
   - Автентифікація (`/api/auth`): `POST /register`, `POST /login`, `POST /logout`, `GET /me`.
   - Дисципліни (`/api/disciplines`): `GET /`, `POST /`, `DELETE /:id` (із блокуванням видалення при наявності прив'язаних завдань — 409 Conflict).
   - Завдання (`/api/tasks`): `GET /` (із підтримкою фільтрів за дисципліною, статусом виконання, діапазоном дат та текстовим пошуком `q`), `POST /`, `GET /:id`, `PATCH /:id` (часткове оновлення та перемикання статусу done з фіксацією `completedAt`), `DELETE /:id`.
   - Керування акаунтом (`/api/account`): `DELETE /` (каскадне видалення користувача та всіх пов'язаних сутностей).
   - Моніторинг (`/api/health`): `GET /` (перевірка з'єднання з базою даних, uptime, статус сервісу).
   - Стандартизована обробка помилок у `src/middleware/errorHandler.js` (`AppError`, валідація Zod з поверненням 422 та об'єкта `fields`).

6. **Тестування та якість коду:**
   - Налаштовано тестове середовище на базі `vitest` та `supertest` із підключенням до реальної БД PostgreSQL (`studyplanner_test` на порті 5433).
   - Написано 63 інтеграційні тести, що покривають усі сценарії, включаючи перевірку прав власності (multi-tenancy isolation), валідацію вхідних даних, CSRF-захист, фільтрацію та каскадне видалення.
   - Досягнуто покриття коду рядками (lines coverage): **89.22%** (при нормативі >= 85%).
   - Налаштовано лінтер ESLint 9 (flat config) у `server/eslint.config.mjs` — `0 errors, 0 warnings`.

7. **Документація:**
   - Створено файл з прикладами запитів `docs/api-examples.http` для тестування API через REST-клієнт або curl.

---

## 2. Запущені команди та їх результати

| Команда                                                 | Призначення                                            | Результат                                                                              |
| ------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `npm install` (у каталозі `server`)                     | Встановлення залежностей                               | Успішно (додано 308 пакетів; модуль `argon2` зібрався з використанням prebuilt binary) |
| `docker compose -f ../docker-compose.yml up -d db_test` | Запуск тестової БД PostgreSQL                          | Контейнер `studyplanner_db_test` піднято на порті 5433                                 |
| `npm test`                                              | Запуск тестового набору Vitest із розрахунком покриття | **63/63 тестів успішно пройдено (5 тест-сьютів)**. Покриття рядків: **89.22%**         |
| `npm run lint`                                          | Статичний аналіз коду через ESLint 9                   | **0 помилок, 0 попереджень**                                                           |

---

## 3. Відомі обмеження

1. **Роздача статичного клієнта:** У Фазі 1 бекенд перевіряє наявність каталогу `../client` за допомогою `fs.existsSync`. Оскільки файли фронтенду будуть перенесені до `client/` у Фазі 2 за допомогою `git mv`, наразі роздача статики коректно очікує завершення Фази 2.
2. **Rate Limiting у тестах:** Лімітування кількості запитів пропущено в тестовому режимі (`skip: () => config.NODE_ENV === 'test'`) для запобігання нестабільності тестів.
3. **Хмарна база даних:** Локальні тести та розробка працюють проти локального PostgreSQL у Docker. Для production-деплою на Neon буде використано той самий рушій міграцій `src/db/migrate.js` з автоматичним увімкненням SSL.

---

## 4. Список створених та змінених файлів

### Інфраструктура та конфігурація

- `docker-compose.yml`
- `server/.env.example`
- `server/.env`
- `server/package.json`
- `server/vitest.config.mjs`
- `server/eslint.config.mjs`

### Вихідний код сервера (`server/src/`)

- `server/src/config.js`
- `server/src/app.js`
- `server/src/index.js`
- `server/src/db/pool.js`
- `server/src/db/migrate.js`
- `server/src/db/seed.js`
- `server/src/db/migrations/001_create_extensions.sql`
- `server/src/db/migrations/002_create_users.sql`
- `server/src/db/migrations/003_create_sessions.sql`
- `server/src/db/migrations/004_create_disciplines.sql`
- `server/src/db/migrations/005_create_tasks.sql`
- `server/src/middleware/AppError.js`
- `server/src/middleware/errorHandler.js`
- `server/src/middleware/requireAuth.js`
- `server/src/middleware/originCheck.js`
- `server/src/schemas/auth.js`
- `server/src/schemas/disciplines.js`
- `server/src/schemas/tasks.js`
- `server/src/services/auth.js`
- `server/src/services/disciplines.js`
- `server/src/services/tasks.js`
- `server/src/services/account.js`
- `server/src/controllers/auth.js`
- `server/src/controllers/disciplines.js`
- `server/src/controllers/tasks.js`
- `server/src/controllers/account.js`
- `server/src/controllers/health.js`
- `server/src/routes/auth.js`
- `server/src/routes/disciplines.js`
- `server/src/routes/tasks.js`
- `server/src/routes/account.js`
- `server/src/routes/health.js`

### Тестовий набір (`server/tests/`)

- `server/tests/helpers/setup.js`
- `server/tests/helpers/db.js`
- `server/tests/helpers/app.js`
- `server/tests/auth.test.js`
- `server/tests/tasks.test.js`
- `server/tests/disciplines.test.js`
- `server/tests/account.test.js`
- `server/tests/health.test.js`

### Документація

- `docs/api-examples.http`
- `docs/prompts/01-server-scaffold.md`
- `docs/phases/phase1.md`

---

## 5. Додаток: результати повторного рев'ю (04.11.2026)

Після першого звіту Фазу 1 було перевірено живими запитами та виправлено 8 дефектів, які не були зловлені початковим набором тестів.

### 5.1. Виправлені дефекти

1. **Битий UUID у `:id` → 500.** Додано `src/middleware/validateUuidParam.js` та `src/utils/uuid.js`; тепер некоректний ідентифікатор повертає `404 NOT_FOUND` (не відрізняючи «не існує» від «не може існувати»).
2. **Битий або підроблений `sp_session` → 500.** Cookie тепер має формат `<uuid>.<HMAC-SHA256>` (`src/utils/sessionCookie.js`), `SESSION_SECRET` реально використовується, підпис перевіряється через `timingSafeEqual`; невалідне значення → `401 SESSION_EXPIRED` без звернення до БД.
3. **Неіснуюча дата у `from`/`to` → 500.** `src/schemas/tasks.js` переписано: `deadline`, `from`, `to` проходять перевірку реальної календарної дати; `2027-02-31` → `422`.
4. **429 на `GET /api/auth/me`.** Лімітери розділено (`src/middleware/rateLimiters.js`): 10/хв лише для `POST /register` і `POST /login`, 100/хв для решти API.
5. **Англійські повідомлення PATCH.** Усі повідомлення `updateTaskSchema`/`listTasksSchema` перекладено українською; порожній PATCH відхиляється з `422`.
6. **Health 200 при збої БД.** `src/controllers/health.js` повертає `503 { status: "degraded", db: "error" }`.
7. **Production-SSL блокував локальну БД.** SSL і `Secure`-cookie відв'язано від `NODE_ENV`; додано `DATABASE_SSL`, `DATABASE_SSL_REJECT_UNAUTHORIZED`, `COOKIE_SECURE`.
8. **Seed: субота замість неділі та відсутність транзакції.** Дати винесено в `src/db/seedDates.js` (UTC-арифметика, локальна «сьогоднішня» дата), `seed()` обгорнуто в `BEGIN/COMMIT/ROLLBACK`.

Додатково: централізований мапінг PostgreSQL-помилок (`23505`, `23503`, `22P02`, `22007`, `22008`) у `src/db/pgErrors.js`, обробка гонок унікальності у сервісах, оновлені `.env.example` і документація.

### 5.2. Повторний прогін

| Команда        | Результат                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `npm test`     | **155/155 тестів пройдено (15 тест-файлів)**; покриття рядків **99.02%**, гілок 98.78%, функцій 100% |
| `npm run lint` | **0 помилок, 0 попереджень**                                                                         |

Нові тести: `rate-limit.test.js`, `seed-dates.test.js`, `pg-errors.test.js`, `db-failures.test.js` (fault-injection `pool.query` для `23505`/`23503`/`22007`), `session-cookie.test.js` (підпис, `timingSafeEqual`, `Secure`), `config.test.js` (fail-fast, `TRUST_PROXY`, pool error), `origin-check.test.js` (CSRF/Content-Type), `error-handler.test.js` (логування, production-повідомлення, `AppError.fields`), `static.test.js` (роздача клієнта на тимчасовому каталозі), `pool.test.js` (SSL-політика та розмір пулу); розширено `auth.test.js`, `tasks.test.js`, `disciplines.test.js`, `health.test.js`.

Залишкові непокриті рядки — `config.js` (fail-fast `process.exit(1)`), `app.js` (`TRUST_PROXY`, morgan) — перевіряються в дочірніх Node-процесах або залежать від середовища; V8 не інструментує дочірні процеси, тому вони не входять у відсоток.

### 5.3. Нові файли

- `server/src/utils/uuid.js`
- `server/src/utils/sessionCookie.js`
- `server/src/middleware/validateUuidParam.js`
- `server/src/middleware/rateLimiters.js`
- `server/src/db/pgErrors.js`
- `server/src/db/seedDates.js`
- `server/src/db/poolOptions.js`
- `server/src/static.js`
- `server/tests/rate-limit.test.js`
- `server/tests/seed-dates.test.js`
- `server/tests/pg-errors.test.js`
- `server/tests/db-failures.test.js`
- `server/tests/session-cookie.test.js`
- `server/tests/config.test.js`
- `server/tests/origin-check.test.js`
- `server/tests/error-handler.test.js`
- `server/tests/static.test.js`
- `server/tests/pool.test.js`
