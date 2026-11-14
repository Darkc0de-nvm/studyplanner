'use strict';
const { registerSchema } = require('../src/schemas/auth');

describe('Zod 4 error messages', () => {
  it('uses the required message when a field is missing', () => {
    const result = registerSchema.safeParse({ email: 'a@example.com', password: 'Password1!', acceptedTerms: true });
    expect(result.success).toBe(false);
    const issue = result.error.issues.find((item) => item.path[0] === 'name');
    expect(issue.message).toBe('Ім\'я обов\'язкове.');
  });

  it('uses the type message when a field has the wrong type', () => {
    const result = registerSchema.safeParse({ name: 42, email: 'a@example.com', password: 'Password1!', acceptedTerms: true });
    expect(result.success).toBe(false);
    const issue = result.error.issues.find((item) => item.path[0] === 'name');
    expect(issue.message).toBe('Ім\'я має бути рядком.');
  });
});
