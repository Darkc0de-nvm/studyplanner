# StudyPlanner

[![CI](https://github.com/Darkc0de-nvm/studyplanner/actions/workflows/ci.yml/badge.svg)](https://github.com/Darkc0de-nvm/studyplanner/actions/workflows/ci.yml)

Вебзастосунок для планування навчальних завдань і дедлайнів. Це full-stack проєкт: статичний клієнт на HTML, CSS і JavaScript, REST API на Node.js та Express і PostgreSQL для зберігання даних.

## Статус проєкту

Фази 3 (безпека, доступність, продуктивність і CI) та 4 (безкоштовне хмарне розгортання) завершено. Навчальний деплой працює на Render Free із PostgreSQL у Neon Free: [відкрити застосунок](https://studyplanner-ec5s.onrender.com). Подробиці й результати перевірок наведені у звітах [Фази 3](docs/phases/phase3.md) та [Фази 4](docs/phases/phase4.md), а параметри хостингу — у [посібнику з розгортання](docs/deployment.md).

## Стек

- **Клієнт:** HTML5, CSS3, JavaScript без збирача; локальний шрифт Geist.
- **Сервер:** Node.js 22.x (точна версія зафіксована в `.node-version`), Express 4, Zod для валідації.
- **Дані й авторизація:** PostgreSQL 16, сесійні HttpOnly cookie, хешування паролів Argon2id.
- **Перевірки:** Vitest і Supertest для API; Playwright для наскрізних сценаріїв у Chromium та Firefox; ESLint.
- **Локальна інфраструктура:** Docker Compose для PostgreSQL.

## Структура

```text
StudyPlanner/
├── client/                     # Статичний клієнт, який віддає Express
│   ├── *.html                  # Сторінки та стани інтерфейсу
│   ├── css/                    # Загальні стилі й стилі сторінок
│   ├── js/                     # Скрипти клієнта
│   └── assets/fonts/           # Локальні шрифти Geist
├── server/
│   ├── src/
│   │   ├── routes/             # Маршрути API
│   │   ├── controllers/        # HTTP-обробники
│   │   ├── services/           # Бізнес-логіка
│   │   ├── schemas/            # Схеми валідації
│   │   ├── middleware/         # Авторизація та проміжні обробники
│   │   └── db/                 # Підключення, міграції та seed
│   ├── tests/                  # API-тести
│   ├── e2e/                    # Playwright і налаштування e2e-БД
│   └── package.json
├── docs/
│   ├── api.md                  # Контракт REST API
│   ├── deployment.md           # Безкоштовне хмарне розгортання та відкат
│   ├── requirements.md         # Вимоги до проєкту
│   └── phases/                 # Звіти й план етапів
└── docker-compose.yml           # PostgreSQL для розробки й тестів
```

## Локальний запуск

Потрібні Node.js 22.x і Docker із Docker Compose.

1. Створіть конфігурацію сервера з шаблону:

   ```powershell
   Copy-Item server/.env.example server/.env
   ```

   У `server/.env` замініть `SESSION_SECRET` на випадковий секрет. Наприклад, з каталогу `server` згенеруйте його так:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Із кореня проєкту запустіть локальну базу:

   ```powershell
   docker compose --env-file server/.env up -d db
   ```

3. Встановіть залежності, застосуйте міграції й запустіть сервер:

   ```powershell
   cd server
   npm ci
   npm run migrate
   npm run dev
   ```

Відкрийте [http://localhost:3000](http://localhost:3000). Express віддає клієнт із `client/` і API з `/api`; окремої збірки клієнта немає. Перевірка сервера та бази доступна за адресою [http://localhost:3000/api/health](http://localhost:3000/api/health).

## Хмарне розгортання

Застосунок розгорнуто для навчальної демонстрації на Render Free Web Service із базою Neon Free: [studyplanner-ec5s.onrender.com](https://studyplanner-ec5s.onrender.com). Сервіс засинає після простою, тому перший запит може бути повільним; це не production SLA. Налаштування, міграції, перевірки й обмеження описані в [`docs/deployment.md`](docs/deployment.md).

## Демонстраційні дані

Команда `npm run seed` створює демокористувача, три дисципліни й сім завдань. Якщо `SEED_EMAIL` і `SEED_PASSWORD` не задані, email і пароль генеруються випадково; ім’я за замовчуванням — `Demo User`. Значення можна задати через `SEED_EMAIL`, `SEED_PASSWORD` і `SEED_NAME`. Коли пароль генерується, команда виводить облікові дані в консоль.

`SEED_BASE_DATE` задає базову дату дедлайнів у форматі `YYYY-MM-DD`. Типово береться локальна дата запуску. Щоб відтворити візуальну базу Lab 4, задайте `SEED_BASE_DATE=2026-10-06` у `server/.env` перед запуском seed. Некоректна дата зупиняє seed.

## API

Основні маршрути:

| Метод                    | Шлях                   | Призначення                           |
| ------------------------ | ---------------------- | ------------------------------------- |
| `GET`                    | `/api/health`          | Перевірка сервера й бази даних        |
| `POST`                   | `/api/auth/register`   | Реєстрація користувача                |
| `POST`                   | `/api/auth/login`      | Вхід                                  |
| `GET`                    | `/api/auth/me`         | Дані поточного користувача            |
| `POST`                   | `/api/auth/logout`     | Вихід                                 |
| `GET`, `POST`            | `/api/tasks`           | Список і створення завдань            |
| `GET`, `PATCH`, `DELETE` | `/api/tasks/:id`       | Перегляд, зміна й видалення завдання  |
| `GET`, `POST`            | `/api/disciplines`     | Список і створення дисциплін           |
| `DELETE`                 | `/api/disciplines/:id` | Видалення дисципліни                   |
| `POST`                   | `/api/account/delete`  | Видалення акаунта та пов’язаних даних  |
| `POST`                   | `/api/account/password` | Зміна пароля                          |

Маршрути завдань, дисциплін і акаунта потребують активної сесії. Повний опис форматів запитів і відповідей дивіться у [`docs/api.md`](docs/api.md).

## Тести та перевірки

Перед тестами запустіть PostgreSQL для тестів із кореня проєкту:

```powershell
docker compose --env-file server/.env up -d db_test
```

Потім виконайте тести з каталогу `server`:

```powershell
cd server
npm test
npm run e2e
```

API-тести використовують `studyplanner_test` на порту `5433`. E2E-тести запускають тестовий сервер і використовують окрему базу `studyplanner_e2e` на тому самому порту. **E2E-підготовка щоразу пересоздає цю окрему базу**, тому не вказуйте тут базу з потрібними даними.

Playwright-браузери за потреби встановлюються командою `npm run e2e:install`. Інші команди з каталогу `server`:

```powershell
npm start                 # Запуск сервера
npm run dev               # Розробка з перезапуском при змінах
npm run migrate:status    # Статус SQL-міграцій
npm run seed              # Створення демонстраційних даних
npm run lint              # ESLint для сервера й e2e
npm run e2e:chromium      # E2E лише у Chromium
```

Щоб запустити e2e у Firefox окремо, використайте `npx playwright test --project=firefox`.

### Візуальна база

`npm run e2e` також порівнює скриншоти сторінок у Chromium і Firefox на ширинах 1440, 768 і 390 px, а також 19 ключових станів (діалоги, помилки форм, фільтри, datepicker, меню користувача) на 1440 і 390 px. Для детермінованості e2e-сервер створює акаунт `demo.visual@studyplanner.test` з паролем `Study2026!` і дедлайнами відносно `2026-10-06`, а тест фіксує годинник браузера на цій даті. 124 еталонні знімки (62 сценарії × 2 браузери) генеруються локально в `server/e2e/specs/visual.spec.js-snapshots/`; цей каталог ігнорується git. Після навмисних змін інтерфейсу оновіть їх командою `npx playwright test e2e/specs/visual.spec.js --update-snapshots`.

## Інтерфейс

`states.html` показує демонстраційні стани `tasks.html?state=...`; для перегляду приватних станів потрібен вхід. Список і календар читають дані з API та оновлюють їх спільно. Календар генерує сітку місяця з понеділка, а поле дедлайну підтримує власний календар і ручне введення у форматі `дд.мм.рррр`.

Клієнт не зберігає завдання, пароль або профіль у `localStorage`. Там залишається лише UI-налаштування `studyplanner.ui.v1`.
