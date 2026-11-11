# StudyPlanner

Вебзастосунок для планування навчальних завдань і дедлайнів.

Вебзастосунок для планування навчальних завдань і дедлайнів.

Лабораторна робота №5: клієнт з Lab 3–4 перетворено на full-stack застосунок із REST API, PostgreSQL, серверною авторизацією та e2e-тестами.

## Структура

```text
StudyPlanner/
├── client/                     # Статичний клієнт без збірки
│   ├── index.html              # Головна сторінка
│   ├── tasks.html              # Список завдань
│   ├── tasks-*.html            # Короткі переходи до станів tasks.html
│   ├── calendar.html           # Календар завдань
│   ├── calendar-*.html         # Стани фільтрації календаря
│   ├── login*.html             # Вхід і стан помилки
│   ├── register*.html          # Реєстрація і стан помилки
│   ├── privacy.html, terms.html # Політика конфіденційності та умови
│   ├── 404.html, 500.html, offline.html # Системні сторінки
│   ├── states.html             # Каталог станів інтерфейсу
│   ├── js/                     # Звичайні defer-скрипти (window.StudyPlanner)
│   ├── css/                    # tokens, base, layout, components, utilities, pages
│   └── assets/fonts/           # Локальні файли Geist
├── server/                     # Express 4 + PostgreSQL + Zod
│   ├── src/                    # app, routes, controllers, services, schemas, db
│   ├── tests/                  # Vitest + supertest
│   ├── e2e/                    # Playwright-сценарії та e2e-БД
│   └── playwright.config.js
├── docs/                       # Документація для звіту
├── docker-compose.yml          # PostgreSQL для розробки й тестів
└── README.md
```

## Запуск

Потрібні Node.js ≥22, PostgreSQL 16 (або `docker compose up -d db`) і залежності сервера:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run migrate
npm run seed
npm start
```

Відкрийте http://localhost:3000. Клієнт лежить у `client/` і віддається тим самим Express-сервером; окремої збірки немає.

`states.html` перелічує демонстраційні стани `tasks.html?state=...`. Вони потребують входу й читають дані з API.

## Демо-дані та SEED_BASE_DATE

`npm run seed` створює демо-користувача з трьома дисциплінами та сімома завданнями. Облікові дані беруться з `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME`; якщо пароль не задано, він генерується і друкується один раз.

`SEED_BASE_DATE` у форматі `YYYY-MM-DD` задає базову дату для дедлайнів; типово використовується локальна дата запуску. Для відтворення baseline Lab 4 встановіть `SEED_BASE_DATE=2026-10-06`. Некоректне або неможливе значення зупиняє seed до звернення до бази.

## Що використано

HTML5, CSS3 (Flexbox, Grid, змінні, медіазапити, `:target`, переходи й анімації), JavaScript і локальний шрифт Geist. Сервер: Node.js 22, Express 4, PostgreSQL 16, Zod, Argon2id. Тести: Vitest + supertest для API, Playwright для e2e у Chromium і Firefox.

## Як це зроблено

- Стилі поділені на загальні (`base`, `layout`, `components`, `utilities`) і сторінкові (`css/pages/`). Кольори, розміри й відступи лежать у `css/tokens.css`, тому в компонентах вони не дублюються.
- Верстка підлаштовується під телефон, планшет і широкий екран. Медіазапити є в `css/layout.css` та файлах у `css/pages/`.
- Випадаючі меню використовують `<details>`, діалоги — клас `.modal--open` із запасним `:target` без JavaScript. На сторінці завдань JavaScript додає закриття меню, фокус, клавіатуру та зміну даних; картки й порожні стани клонуються з `<template>`.
- Модальні вікна й елементи керування анімовані. Для тих, у кого в системі ввімкнено зменшення руху, анімації вимикаються через `prefers-reduced-motion`.

## Календар та авторизація

Календар генерує місяці з понеділка, показує завдання з API, відкриває день і підставляє дату в додавання. Поле дати використовує спільний власний календар і ручне введення дд.мм.рррр.

Авторизація серверна: сесія зберігається в HttpOnly cookie `sp_session`, пароль хешується Argon2id. Клієнт не зберігає завдання, користувача чи пароль у localStorage; єдиний ключ — `studyplanner.ui.v1` з `{showDone}`.

Завдання, дисципліни та акаунт зберігаються в PostgreSQL і доступні через `/api/*`. Сторінки списку й календаря використовують спільні маршрути API та ревалідують дані при поверненні фокусу або вкладки. `tasks.html#add-task-date` відкриває форму додавання з календарем.

## ����������

```powershell
cd server
docker compose -f ../docker-compose.yml up -d db_test
npm test          # Vitest + supertest, PostgreSQL studyplanner_test
npm run e2e       # Playwright, ������ �� studyplanner_e2e, Chromium + Firefox
```

E2E-������ ��� ����������� `studyplanner_e2e` � ��������� ������� ����� ��������. ��������� Playwright (`test-results/`, `playwright-report/`) �� ���������.
