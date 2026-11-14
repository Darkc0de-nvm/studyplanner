'use strict';

/**
 * Zod 4 unified error customization for strings.
 * `issue.input` is undefined when the field is missing, which lets us keep
 * separate Ukrainian messages for "required" and "wrong type".
 */
function stringError(requiredMessage, typeMessage) {
  return {
    error: (issue) => (issue.input === undefined ? requiredMessage : typeMessage),
  };
}

module.exports = { stringError };
