# Безкоштовне хмарне розгортання StudyPlanner

> **Статус:** розгорнуто й перевірено 14.11.2026. Застосунок працює на Render Free Web Service із Neon Free; усі 6 міграцій застосовано, `GET /api/health` повернув `status: ok`, `db: ok`. Публічна адреса: [https://studyplanner-ec5s.onrender.com](https://studyplanner-ec5s.onrender.com).

Фактична архітектура — один безкоштовний Node.js Web Service на Render, який обслуговує клієнт і `/api`, та PostgreSQL у Neon Free. Це зберігає same-origin сесії та TLS-з'єднання до БД. Такий варіант призначений для навчальної демонстрації: він має холодні старти, обмежені квоти й не надає production SLA. Розділи нижче фіксують поточні параметри й кроки для повторного розгортання.

Провайдерські панелі й безкоштовні квоти змінюються; перед зміною налаштувань або створенням додаткових ресурсів звіряйте актуальні [Render Free обмеження](https://render.com/docs/free), [Render FAQ про білінг](https://render.com/docs/faq), [Render health checks](https://render.com/docs/health-checks), [Render Node.js version](https://render.com/docs/node-version), [плани Neon](https://neon.com/docs/introduction/plans), [Neon Connect from any app](https://neon.tech/docs/connect/connect-from-any-app) та [Neon connection pooling](https://neon.tech/docs/connect/connection-pooling).

### Безкоштовні плани (перевірено 14.11.2026)

- Render Free Web Service коштує **$0** у межах включених квот. Він засинає після 15 хвилин без вхідного трафіку, а наступний запит може чекати близько хвилини на запуск. Доступно 750 безкоштовних instance-годин на workspace за календарний місяць; файли на диску сервісу тимчасові.
- Neon Free коштує **$0** і включає 100 CU-годин та 1 GB PostgreSQL на проєкт, 5 GB вихідного трафіку та автоматичне засинання compute після 5 хвилин без запитів. При мінімальних 0.25 CU квота відповідає 400 годинам активної роботи БД на місяць.
- Щоб не отримати рахунок Render за перевищення квот, не додавайте платіжний метод до workspace. Якщо він уже є, перевірте billing-налаштування: Render може тарифікувати перевищення вихідного трафіку або build minutes; без платіжного методу сервіси/нові builds призупиняються при вичерпанні відповідної квоти.
- Не переходьте на платні плани й не додавайте платні ресурси. Якщо безкоштовна квота вичерпається, очікуйте тимчасову недоступність до її скидання або зменште використання.
- Ці умови підходять для навчального проєкту; для важливих даних врахуйте обмежену історію відновлення Neon Free та відсутність резервних копій у Render Free Postgres. Цей план використовує Neon, не Render Postgres.

## 1. Поточний стан та передумови

- Розгорнуто merge-коміт `ce36e50` із `main`; успішний CI на Node.js 22.23.5: [run 43580734789](https://github.com/Darkc0de-nvm/studyplanner/actions/runs/43580734789).
- У Git немає `.env`, паролів, `DATABASE_URL` або інших секретів.
- Створені окрема Neon Free база та Render Free Web Service. Не використовуйте тестову БД `studyplanner_e2e`.
- Залишайте Render service і Neon project на планах Free.

## 2. База даних Neon (створено)

1. Neon Free project створено в регіоні AWS Europe (London), project ID `rough-sun-05511851`.
2. У Neon Console відкрийте **Connect** та скопіюйте connection string для Node.js. Збережіть його як секрет; не додавайте до репозиторію або звичайного README.
3. Використовуйте TLS-параметри з connection string. Код проєкту вмикає SSL автоматично для production і Neon host та перевіряє сертифікат за замовчуванням (`DATABASE_SSL=auto`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`).
4. Pooled connection string доречний для звичайного runtime pool. Для міграцій використовуйте connection string, рекомендований Neon для довготривалого адміністративного запиту; уникайте запуску міграцій паралельно.

## 3. Render Web Service (створено)

Render підключено до GitHub-репозиторію `Darkc0de-nvm/studyplanner`, гілка `main`. Поточна конфігурація:

Публічний URL: [https://studyplanner-ec5s.onrender.com](https://studyplanner-ec5s.onrender.com).

| Поле | Значення |
|---|---|
| Runtime | Node |
| Branch | `main` |
| Instance Type | `Free` |
| Root Directory | Корінь репозиторію, не `server/`: Express має бачити каталог `client/` |
| Build Command | `npm ci --prefix server` |
| Start Command | `npm start --prefix server` |
| Health Check Path | Не задавати; залишити стандартну TCP-перевірку Render |

Корінь репозиторію містить `.node-version` зі значенням `22.23.5`; CI читає цей самий файл. `server/package.json` обмежує сумісність до Node.js 22.x, а Render бере версію з `.node-version`. Не покладайтеся на змінний default провайдера.

Не встановлюйте HTTP Health Check Path у Render. Стандартна TCP-перевірка підтверджує, що Node-процес слухає порт, і не викликає БД кожні кілька секунд. Інакше `/api/health` з `SELECT 1` тримав би Neon compute активним, поки Render service запущений. Для ручної перевірки стану сервера й БД відкрийте `GET /api/health`: він виконає `SELECT 1` і поверне HTTP 200 лише коли база доступна. Такий запит будить Neon, який засинає знову після періоду бездіяльності.

Render Free Web Service має тимчасову файлову систему, тому всі користувацькі дані зберігаються тільки в Neon. Сервіс може перезапускатися, а після 15 хвилин без вхідного трафіку засинає; перший наступний запит матиме холодний старт. Використовуйте стандартний `*.onrender.com` домен без додаткових платних опцій.

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

Не додавайте production-пароль у `SEED_PASSWORD` і не запускайте seed без чіткої потреби. Seed створює демонстраційні дані; для навчального деплою користувач може зареєструватися через інтерфейс.

## 5. Міграції та запуск

1. Початкові міграції застосовано локально до Neon через direct/unpooled connection string: `001_create_extensions.sql` … `006_add_terms_accepted_at.sql` (6 applied, 0 skipped). Render Free не має SSH і не запускає pre-deploy command; наступні міграції виконуйте локально через Neon, не зберігаючи production URL у файлах репозиторію.
2. Для migration-процесу потрібні `NODE_ENV=production`, `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=true`, `TRUST_PROXY=1` і `SESSION_SECRET` довжиною від 32 символів. Задавайте їх лише на час команди в локальному середовищі й очистіть після міграції.
3. Перед наступним релізом перевірте в Neon статус міграцій. Не запускайте seed без чіткої потреби.
4. У Render logs переконайтеся, що сервер стартував у `production` без конфігураційних помилок. Живий `GET /api/health` вже перевірено: HTTP 200, `{"status":"ok","db":"ok",...}`.

Перед будь-якою зміною схеми, що видаляє чи перетворює дані, підготуйте резервну копію або відновлювану Neon branch. Не вважайте відкат коду автоматичним відкатом SQL-міграції.

## 6. Smoke-check після deploy

- Перша відповідь після простою може бути повільною через Render cold start і пробудження Neon. Після запуску `GET /api/health` повертає 200 і `db: "ok"`.
- HTTP перенаправляється на HTTPS; сторінки й API доступні з одного origin.
- Реєстрація, вхід, перезавантаження й вихід працюють; session cookie має `HttpOnly`, `Secure`, `SameSite=Lax`.
- Перевірте створення/редагування/видалення завдання та дисципліни на тестовому акаунті.
- Перевірте зміну пароля й видалення окремого тестового акаунта; не використовуйте свій основний акаунт для деструктивного тесту.
- Переконайтеся, що відповідь не віддає stack trace, а production logs не містять паролів, cookie чи повного тіла запитів.
- Перевірте ключові security headers і відкрийте `tasks.html`, `calendar.html`, `privacy.html` та `terms.html` у desktop/mobile viewport.

Результати поточного розгортання занесені до [`phases/phase4.md`](phases/phase4.md). Додайте до нього URL сервісу після копіювання з Render Dashboard. Не публікуйте секрети або connection string у звіті.

## 7. Відкат

1. Якщо новий deploy не проходить health check або smoke-check, поверніть попередній успішний deploy у Render Dashboard.
2. Збережіть логи й версію коміту, яка спричинила проблему.
3. Окремо оцініть стан бази. Не запускайте ручний SQL rollback без сумісної перевіреної міграції та резервної копії.
4. Після виправлення повторіть міграції/перевірки за процедурою вище й лише тоді переведіть сервіс на новий deploy.
