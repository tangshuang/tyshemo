# Validator

Use inner Validator to create a validator.

```js
import { Meta, Validator } from 'tyshemo'

class Required extends Validator {
  static determine = function() {}
  static validate = function() {}
  static message = '{label} is required'
}

class Name extends Meta {
  static label = 'Name'
  static validators = [
    Required,
  ]
}
```

## Builtin Validators Generators

```js
import { Validator } from 'tyshemo'

const {
  required,
  integer,
  url,
  date,
  match,
  maxLen,
  minLen,
  numeral,
  max,
  min,

  merge,
  enume,
} = Validator

class Url extends Validator {
  static validate = merge(required(), url())
  static message = 'Url should required.'
}
```

Each of these static methods is a validator generator.

### required()

Generate a `required` validator.

### numeral(integer, decimal)

Generate a `numeral` validator whose integer part and decimal part should fixed to given length.

```js
const thousands = integer(4, 2) // 1000.00
thousands(200) // true
thousands(9999.01) // true
thousands(10000) // false, integer overflow
thousands(1.001) // false, decimal overflow
```

### max(num)

Generate a `max` validator, the passed number should less than given `num`.

```js
max(100)(200) // false
```

### min(num)

```js
min(100)(99) // false
```

### email()

Should be a string which is an email address.

### url()

Should be a url string.

### date(sep = '-')

Should be a date string whose formatter is `YYYY-MM-DD`.

```js
date()('2020-02-27') // true
date('/')('2020-02-27') // false
date('/')('2020/02/27') // true
```

### match(reg)

```js
match(/[0-9]/)('8') // true
```

### merge(...validators)

Should match all validators

```js
merge(
  required(),
  url(),
)('http://www.oxx.com/') // true
```

### enume(...validators)

Should match one of the given validators.

```js
enume(
  v => typeof v === 'number',
  v => typeof v === 'string' && !isNaN(+v),
)('123') // true
```