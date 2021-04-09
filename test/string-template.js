'use strict';

const should = require('should');
const StringTemplate = require('../src/lib/string-template');

describe('StringTemplate', () => {
  let string = 'The {{jumper:adjective}} {{ jumper:color }} {{jumper:animal}}';

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

  it('toJSON converts to a string correctly', () => {
    template.toJSON().should.equal(expected);
  });

  it('substitutes values into a template string correctly', () => {
    template.toString().should.equal(expected);
  });

  it('throws a ReferenceError if a substitutes references an undefined variable', () => {
    const throwsAnError = new StringTemplate(undefinedSubstitution, scope);

    should.throws(() => throwsAnError.toString(), ReferenceError);
  });

  it('correctly substitutes a template string if given valid properties', () => {
    const t = StringTemplate.coerce('{{foo:bar}}', {foo: {bar: 'baz'}});

    t.should.equal('baz');
  });

  it('returns the original string if it\'s not a valid template', () => {
    const t = StringTemplate.coerce('foo:bar}}', {foo: 1});

    t.should.equal('foo:bar}}');
  });

  it('iterates through a deep object and substitutes template values', () => {
    const _scope = {
      watermelon: 'test',
      yo: {lo: 'slap'}
    };
    const _template = {
      value: 'this is a {{ watermelon }}',
      complex: Promise.resolve(),
      node: {
        list: ['of', {
          objects: '{{yo:lo}}'
        }]
      }
    };

    const rendered = StringTemplate.render(_template, _scope);

    rendered.value.should.equal('this is a test');
    rendered.complex.should.equal(_template.complex);
    rendered.node.list.should.containDeep(['of', {objects: 'slap'}]);
  });
});
