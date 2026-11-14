'use strict';
const pool = require('../src/db/pool');
const { runMigrations, cleanDb } = require('./helpers/db');
const { seed } = require('../src/db/seed');

describe('demo seed', () => {
  beforeAll(runMigrations);
  beforeEach(cleanDb);
  afterAll(cleanDb);

  it('recreates the Lab 4 task set relative to SEED_BASE_DATE', async () => {
    const result = await seed({
      email: 'seed-test@example.com',
      password: 'SeedPass1!',
      acceptedTerms: true,
      name: 'Seed Test',
      baseDate: '2026-10-06',
    });
    expect(result).toEqual({ created: true, email: 'seed-test@example.com' });

    const { rows } = await pool.query(`
      SELECT t.title, t.description, t.deadline::text AS deadline, t.done, d.name AS discipline
      FROM tasks t
      JOIN disciplines d ON d.id = t.discipline_id
      ORDER BY t.deadline, t.title
    `);

    expect(rows).toEqual([
      {
        title: 'Скласти конспект за темою «Кеш-пам’ять»',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-02',
        done: true,
        discipline: 'Архітектура комп’ютера',
      },
      {
        title: 'Додати інтерактивні елементи на головну сторінку',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-03',
        done: false,
        discipline: 'Web-дизайн',
      },
      {
        title: 'Оформити звіт з лабораторної роботи №3',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-04',
        done: false,
        discipline: 'Архітектура комп’ютера',
      },
      {
        title: 'Виконати нормоконтроль лекційного матеріалу',
        description: '',
        deadline: '2026-10-06',
        done: false,
        discipline: 'Бази даних',
      },
      {
        title: 'Підготувати презентацію до захисту проєкту',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-11',
        done: false,
        discipline: 'Архітектура комп’ютера',
      },
      {
        title: 'Оновити базу даних для фінального проєкту',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-15',
        done: false,
        discipline: 'Бази даних',
      },
      {
        title: 'Підготувати підсумковий звіт за курсовий проєкт',
        description: 'Додати скриншоти виконання, схему алгоритму та висновки. Здати до практичного заняття через Moodle.',
        deadline: '2026-10-18',
        done: false,
        discipline: 'Архітектура комп’ютера',
      },
    ]);
  });

  it('rejects an invalid SEED_BASE_DATE before touching the database', async () => {
    await expect(
      seed({
        email: 'seed-test@example.com',
        password: 'SeedPass1!',
      acceptedTerms: true,
        baseDate: '2026-02-30',
      })
    ).rejects.toThrow(/valid calendar date/);
  });
});
