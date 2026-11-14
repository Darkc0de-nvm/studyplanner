# Production-розгортання StudyPlanner

> **Статус:** інструкція для майбутнього розгортання. Ресурси Render/Neon ще не створені, production URL і результати перевірок не заповнені.

Цільова архітектура — один Node.js Web Service на Render, який обслуговує клієнт і `/api`, та керована PostgreSQL у Neon. Це зберігає same-origin сесії та виконує вимоги NFR-23/NFR-24 з [`requirements.md`](requirements.md). Перевірте актуальну доступність, умови планів і тариф перед створенням ресурсів.

Провайдерські панелі змінюються; звіряйте кроки з [Render Web Services](https://render.com/docs/web-services), [Render Node.js version](https://render.com/docs/node-version), [Render Health Checks](https://render.com/docs/health-checks), [Neon Connect from any app](https://neon.tech/docs/connect/connect-from-any-app) та [Neon connection pooling](https://neon.tech/docs/connect/connection-pooling).

## 1. Передумови

- Фаза 3 та всі поточні зміни перевірені повторним CI-прогоном; production розгортайте з перевіреного коміту в `main`.
- У Git немає `.env`, паролів, `DATABASE_URL` або інших секретів.
- Для production створюються окрема база й окремий Render service. Не використовуйте тестову БД `studyplanner_e2e`.
- Вибір планів робіть за актуальними умовами провайдерів, не покладаючись на старі оцінки безкоштовних квот.

## 2. Створіть базу даних у Neon

1. Створіть Neon project і production database/branch.
2. У Neon Console відкрийте **Connect** та скопіюйте connection string для Node.js. Збережіть його як секрет; не додавайте до репозиторію або звичайного README.
3. Використовуйте TLS-параметри з connection string. Код проєкту вмикає SSL автоматично для production і Neon host та перевіряє сертифікат за замовчуванням (`DATABASE_SSL=auto`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`).
4. Pooled connection string доречний для звичайного runtime pool. Для міграцій використовуйте connection string, рекомендований Neon для довготривалого адміністративного запиту; уникайте запуску міграцій паралельно.

## 3. Створіть Render Web Service

Підключіть GitHub-репозиторій і задайте:

| Поле | Значення |
|---|---|
| Runtime | Node |
| Branch | `main` |
| Root Directory | Корінь репозиторію, не `server/`: Express має бачити каталог `client/` |
| Build Command | `npm ci --prefix server` |
| Start Command | `npm start --prefix server` |
| Health Check Path | `/api/health` |

Виберіть точну підтримувану версію Node.js 22 або новішу та узгодьте її з `engines.node` у `server/package.json`. Не покладайтеся на змінний default Node version провайдера.

`/api/health` виконує `SELECT 1` і повертає HTTP 200 лише коли доступна база даних, тому це перевірка готовності, а не тільки процесу.

## 4. Environment variables

Задайте змінні у Render Dashboard як runtime environment variables/secrets:

| Змінна | Production-значення |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Connection string із Neon; секрет |
| `SESSION_SECRET` | Випадковий секрет щонайменше 32 символи; генеруйте локально, не комітьте |
| `TRUST_PROXY` | `1` для reverse proxy Render |
| `COOKIE_SECURE` | `auto` — в production встановлює `Secure` |
| `DATABASE_SSL` | `auto` або `true` для примусового TLS |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | `true` |

Не задавайте `COOKIE_DOMAIN`, якщо не налаштовуєте власний домен. Не фіксуйте `PORT`: Render передає порт сервісу, а сервер читає `process.env.PORT`. `SESSION_MAX_AGE` має безпечне значення за замовчуванням.

Не додавайте production-пароль у `SEED_PASSWORD` і не запускайте seed без чіткої потреби. Seed створює демонстраційні дані, а production має починатися з порожніх користувацьких даних.

## 5. Міграції та перший запуск

1. Перш ніж приймати трафік, застосуйте SQL-міграції до production database з контрольованого середовища, де доступні `DATABASE_URL` і змінні конфігурації.
2. Для запуску з каталогу `server` використовуйте `node src/db/migrate.js`, якщо змінні вже експортовані в середовище процесу. Локальний `npm run migrate` призначений для `.env` і не є готовою Render-командою.
3. Якщо вибраний Render plan підтримує Pre-Deploy Command, можна налаштувати `cd server && node src/db/migrate.js`. Інакше виконайте міграцію окремо перед deploy.
4. Перевірте у логах, що сервер стартував у `production` без конфігураційних помилок, а `/api/health` повертає `{"status":"ok","db":"ok",...}`.

Перед будь-якою зміною схеми, що видаляє чи перетворює дані, підготуйте резервну копію або відновлювану Neon branch. Не вважайте відкат коду автоматичним відкатом SQL-міграції.

## 6. Smoke-check після deploy

- `GET /api/health` повертає 200 і `db: "ok"`.
- HTTP перенаправляється на HTTPS; сторінки й API доступні з одного origin.
- Реєстрація, вхід, перезавантаження й вихід працюють; session cookie має `HttpOnly`, `Secure`, `SameSite=Lax`.
- Перевірте створення/редагування/видалення завдання та дисципліни на тестовому акаунті.
- Перевірте зміну пароля й видалення окремого тестового акаунта; не використовуйте свій основний акаунт для деструктивного тесту.
- Переконайтеся, що відповідь не віддає stack trace, а production logs не містять паролів, cookie чи повного тіла запитів.
- Перевірте ключові security headers і відкрийте `tasks.html`, `calendar.html`, `privacy.html` та `terms.html` у desktop/mobile viewport.

Запишіть у [`phases/phase4.md`](phases/phase4.md) production URL, дату, результат smoke-check і посилання на успішний deploy/CI. Не публікуйте секрети або connection string у звіті.

## 7. Відкат

1. Якщо новий deploy не проходить health check або smoke-check, поверніть попередній успішний deploy у Render Dashboard.
2. Збережіть логи й версію коміту, яка спричинила проблему.
3. Окремо оцініть стан бази. Не запускайте ручний SQL rollback без сумісної перевіреної міграції та резервної копії.
4. Після виправлення повторіть міграції/перевірки за процедурою вище й лише тоді переведіть сервіс на новий deploy.
