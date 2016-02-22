/* eslint-env mocha */
'use strict';

const should = require('should');
const StringTemplate = require('../lib/string-template');

describe('StringTemplate', () => {
  let string = 'The {{ jumper:adjective }} {{ jumper:color }} {{ jumper:animal }}';

  string += ' jumped {{ preposition }} the... What ever, I\'m hungery';

  const expected = 'The quick red fox jumped over the... What ever, I\'m hungery';
  const notATemplate = 'This isn\'t a template';

  const undefinedSubstitution = 'This template references {{ an:invalid }} variable!';

  const scope = {
    jumper: {
      adjective: 'quick',
      color: 'red',
      animal: 'fox'
    },
    preposition: 'over'
  };

  const template = new StringTemplate(string, scope);

  it('detects valid template strings', () => {
    StringTemplate.isTemplate(string).should.equal(true);
  });

  it('detects invalid template strings', () => {
    StringTemplate.isTemplate(notATemplate).should.equal(false);
  });

  it('substitutes values into a template string correctly', () => {
    template.toString().should.equal(expected);
  });

  it('throws a ReferenceError if a substitutes references an undefined variable', () => {
    const throwsAnError = new StringTemplate(undefinedSubstitution, scope);

    should.throws(() => throwsAnError.toString(), ReferenceError);
  });
});
