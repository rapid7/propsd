/* eslint-disable camelcase, no-unused-expressions,  */
const StringTemplate = require('../lib/util/string-template');
const expect = require('chai').expect;

describe('Utilities: Class StringTemplate', function () {
  let string = 'The {{ jumper.adjective }} {{ jumper.color }} {{ jumper.animal }}';
  string += ' jumped {{ preposition }} the... What ever, I\'m hungery';

  const expected = 'The quick red fox jumped over the... What ever, I\'m hungery';
  const not_a_template = 'This isn\'t a template';
  const undefined_substitution = 'This template references {{ an.invalid }} variable!';

  const scope = {
    jumper: {
      adjective: 'quick',
      color: 'red',
      animal: 'fox'
    },
    preposition: 'over'
  };

  const template = new StringTemplate(string, scope);

  it('detects valid template strings', function () {
    expect(StringTemplate.isTemplate(string)).to.be.true;
    expect(StringTemplate.isTemplate(not_a_template)).to.be.false;
  });

  it('substitutes values into a template string correctly', function () {
    expect(template.toString()).to.equal(expected);
  });

  it('throws a ReferenceError if a substitutes references an undefined variable', function () {
    expect(function () {
      const throws_an_error = new StringTemplate(undefined_substitution, scope);
      throws_an_error.toString();
    }).to.throw(ReferenceError);
  });
});
