Class: StringTemplate
=====================

Parse strings with embedded template values. By default, double-mustache operators (`{{ reference }}`) delimit replacement fields.

### Constructor `(template, scope)`

* parameter `template`  {`String`}  A string with replacement fields
* parameter `scope`     {`Object`}  An object that replacement fields may reference for values

### Constant `StringTemplate.CAPTURE`

A regular expression used to detect and replace template-fields. The expression must have one capture, and be greedy. The default expression is `/\{\{ ?(.+?) ?\}\}/g;`

### Constant `StringTemplate.DELIMITER`

A string used to delimit the key-path of replacement references. By default, this is a single colin (`:`), to avoid conflict with property-keys that contain dots.

Using the following `scope` Object, and the default CAPTURE and DELIMITER,

```json
{
  "a": {
    "thing": {
      "experiment": "a test.",
      "announcement": "a public service announcement!",
      "drill": "NOT A TEST!!!"
    }
  }
}
```

The template string "This is {{ a:thing:experiment }}" renders "This is a test.".

### Class Method `isTemplate(string)`

Test if the input string is a template, e.g. has one of more replacement fields.

### Class Method `coerce(string, scope)`

Test if the input string is a template. If so, create a StringTemplate and return it's resulting string. Otherwise, just return the input string.

### Method `toString()`

_Alias `toJSON()`_

Render the string value of a StringTemplate instance.
