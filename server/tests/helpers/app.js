'use strict';
const supertest = require('supertest');
const app = require('../../src/app');

/** Create a supertest agent (maintains cookies across requests) */
function agent() {
  return supertest.agent(app);
}

/** Create a plain supertest instance (no cookie persistence) */
function request() {
  return supertest(app);
}

module.exports = { agent, request };
