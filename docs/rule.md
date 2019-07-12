# Rule

`Rule` is a constructor called by new.

## Usage

To create a rule, you should use `Rule`.

```js
import { Rule } from 'tyshemo'

// pass options
const SomeRule = new Rule({
  name: 'SomeRule',
  prepare: function(value, key, target) {},
  validate: function(value) {
    return typeof value === 'string'
  },
  override: function(value, key, target) {
    target[key] = value + '' // make it a string
  },
  complete: function() {},
})

// pass validate function only
const NoNameRule = new Rule(function(value) {
  return typeof value === 'string'
})
```

Use a rule as a pattern:

```js
const SomeType = new Type(SomeRule)
```

**validate**

To check a variable with rule:

```js
let error1 = SomeRule.validate('12') // null or undefined
let error2 = SomeRule.validate(12) // error
```

**validate2**

Run validate second time after getting an error from the first validation and overriding.

```js
const obj = {
  name: 'tomy',
  age: 10,
}

let error1 = SomeRule.validate2(obj.name, 'name', obj) // null or undefined
let error2 = SomeRule.validate2(obj.age, 'age', obj) // null or undefined, obj.age will be overrided to be '10'
```

## Internal Rules

We have built some internal rules:

- Int: should be interger number
- Float: should be float number
- Numeric: number or number string
- Null: should be null
- Undefined: should be undefined
- Any: any value

```js
import { Numeric, Any } from 'tyshemo'
const SomeType = new Dict({
  name: String,
  age: Int,
  have: Any,
})
```

## Internal Rule Generators

We have some internal functions which to create rules in simple ways.
For example:

```js
import { ifexist } from 'tyshemo'
const SomeRule = ifexist(Number)
```

The rule generators will create some rules which have different logic.

**validate**

If the value does not match `pattern`, an error with `message` will be throw.

- @param {Function|Pattern} pattern


```js
const SomeRule = validate(value => typeof value === 'string', 'It should be a string.')
const NumberRule = validate(Number, 'It should be a number.')
```

**asynchronous**

The rule will use the real rule later depended on the passed fn.

- @param {Function} fn which should return a pattern

```js
const SomeRule = asynchronous(() => new Promise((resolve) => {
  setTimeout(() => resolve(Number), 500)
}) // SomeRule will be set to Number after a async task
```

**shouldmatch**

The passed value should match all passed patterns.

- @param {...Pattern} patterns

It always used with `validate`.

```js
const SomeRule = shouldmatch([
  validate(String, 'It should be a string.'),
  validate(Numeric, 'It should be a number.'),
])
```

**shouldnotmatch**

The passed value should not match all passed patterns.

- @param {...Pattern} patterns

```js
const SomeRule = shouldnotmatch([String, Number])
```

**ifexist**

If the key of this dict exists, the passed rule will be used.
If the key does not exist, the rule will be ignored.

- @param {Any} rule

```js
import { dict, ifexist } from 'hello-type'

const PersonType = dict({
  name: String,
  age: ifexist(Number),
})
PersonType.test({ name: 'tomy' }) // true
PersonType.test({ name: 'tomy', age: 10 }) // true
PersonType.test({ name: 'tomy', age: null }) // false
```

If there is `age` property, PersonType will check its value.
If `age` property does not exist, the checking will be ignored.

This rule will not work in dict strict mode:

```js
PersonType.Strict.test({ name: 'tomy' }) // false
```

In strict mode, `ifexist` will be ignored, you must pass certain type of data to assert.

`ifexist` only works for Dict and Tuple.

```js
const PersonType = dict({
  name: String,
  children: [Object], // => can be '[]' or '[{...}, ...]'
})
const ParamsType = tuple([String, ifexist(Number)]) // => can be ('name') or ('name', 10)
```

`ifexist` is not allowed in List, Enum or using directly.

**ifnotmatch**

If the target not match passed rule, you can set a value to replace.
Only works for dict.

- @param {Pattern} pattern
- @param {Function|Any} callback

```js
const SomeType = dict({
  name: String,
  age: ifnotmatch(Number, 0),
})
const some = {
  name: 'tomy',
}

SomeType.assert(some) // without any error
// => some.age === 0
```

The second parameter can be a function to return the final value.

```js
const SomeType = dict({
  name: String,
  age: ifnotmatch(Number, (value, key, target) => {
    return +value
  }),
})
```

Notice, this method will change your original data, so be careful when you use it.


**determine**

Determine which pattern to use.

Sometimes, you want your rule depends on the prop's parent node, with different value, with different rule. Determine do not check the prop value type immediately, it use the return value of factory as a rule to check data type.

- @param {Function} fn which to return a pattern

```js
const SomeType = dict({
  name: String,
  isMale: Boolean,
  // data type check based on person.isMale
  touch: determine(function(value, key, person) {
    if (person.isMale) {
      return String
    }
    else {
      return Null
    }
  }),
})
```

**shouldexist**

Advance version of ifexist, determine whether a prop can not exist with a determine function, if the prop is existing, use the passed type to check.

- @param {Function} determine the function to return true or false,if true, it means the prop should must exists and will use the second parameter to check data type, if false, it means the prop can not exist
- @param {Pattern} pattern when the determine function return true, use this to check data type

```js
const SomeType = dict({
  name: String,
  isMale: Boolean,
  // touch should exist if person.isMale is truthy
  touch: shouldexist((value, key, person) => person.isMale, String),
})
```

**shouldnotexist**

Advance version of ifexist, determine whether a prop can not exist with a determine function, if the prop is existing, use the passed type to check.

- @param {Function} determine the function to return true or false, if true, it means the prop should must exists and will use the second parameter to check data type, if false, it means the prop can not exist
- @param {Function} determine when the determine function return true, use this to check data type

```js
const SomeType = dict({
  name: String,
  isMale: Boolean,
  // touch should not exist if person.isMale is truthy
  touch: shouldnotexist((value, key, person) => person.isMale),
})
```

**beof**

The value should be an instance of given class:

```js
class MyPattern {}
const MyType = dict({
  someObj: beof(MyPattern),
  age: beof(Number),
})

let myins = new MyPattern()
let age = new Number(10)
MyType.test({ somObj: myins, age }) // true
```

**equal**

The value should equal to the given value, the given value can be anything.

```js
const MyType = dict({
  type: equal(Number)
})
MyType.assert({ type: Number }) // true
```

**lambda**

The value should be a function, and the parameters and return value should match passed rules.

Notice: this rule can only used in array or object, and will modify the original function.

- @param InputType: should best be Tuple if you have multiple arguments
- @param OutputType

```js
const SomeType = Dict({
  fn: Lambda(Tuple(String, Number), Object),
})
const some = {
  fn: (str, num) => ({ str, num }),
}

SomeType.assert(some)
some.fn('tomy', null) // throw error because the second parameter is not Number
```

Notice: If the params not match the type, the function will not run any more. So don't use it if you do not know whether you should.
