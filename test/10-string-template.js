var StringTemplate = require('../lib/util/string-template');
var expect = require('chai').expect;

describe('Utilities: Class StringTemplate', function() {
  var string = 'The {{ jumper.adjective }} {{ jumper.color }} {{ jumper.animal }} jumped {{ preposition }} the... What ever, I\'m hungery';
  var expected = 'The quick red fox jumped over the... What ever, I\'m hungery';
  var not_a_template = 'This isn\'t a template';
  var undefined_substitution = 'This template references {{ an.invalid }} variable!';

  var scope = {
    jumper: {
      adjective: 'quick',
      color: 'red',
      animal: 'fox'
    },
    preposition: 'over'
  };

  var template = new StringTemplate(string, scope);

  it('detects valid template strings', function() {
    expect(StringTemplate.isTemplate(string)).to.be.true;
    expect(StringTemplate.isTemplate(not_a_template)).to.be.false;
  });

  it('substitutes values into a template string correctly', function() {
    expect(template.toString()).to.equal(expected);
  });

  it('throws a ReferenceError if a substitutes references an undefined variable', function() {
    expect(function() {
      var throws_an_error = new StringTemplate(undefined_substitution, scope);
      throws_an_error.toString();
    }).to.throw(ReferenceError);
  });
});
