# Prototype

Prototype is to describe data automic type which points out the data's nature, quality or characteristic.

In TySheMo, we do not need to describe the deep theory, we just need to define a way to check whether the given value matches the given prototype.

## Native Prototypes

We use native definition/interface as prototypes:

- String
- Number: finite number, not match `NaN` `"123"`
- Boolean: only `true` or `false`
- Object: normal object like `{}`, not match instances, array and Object self
- Array: normal array like `[]`
- Function: function
- regexp: string which match regexp, i.e. /^\[0-9].*/
- Symbol
- NaN: only match `NaN`, notice, it is not `isNaN`
- Infinity
- Date: an instanceof Data (new Date)
- Promise: an instance of Promise (new Promise)
- Error: an instance of Error
- RegExp: an instance of RegExp

In fact, all classes can be a prototype, even the custom classes which are defined by yourself.
For example, `const a = new A()`, here `A` is the prototype of `a`.

## Internal Prototypes

And we have some prototypes:

- Int
- Float
- Negative
- Positive
- Finity
- Zero
- Natural
- Numeric: number or string, read more under the following
- String8: string max-length 8
- String16
- String32
- String64
- String128
- Null: null
- Undefined: undefined
- None: null | undefined
- Any

These prototypes can be import from the package:

```js
import { Int, Any } from 'tyshemo'
```

All numeric prototypes (Int, Float, Negative, Positive, Zero, Natural, Numeric) has `Number` and `String` sub prototype. For example:

```js
import { Int, Numeric } from 'tyshemo'

Int.Number.assert(1)
Int.String.assert('1')

Numeric.assert(1)
Numeric.assert('1')
Numeric.Number.assert(1)
Numeric.String.assert('1')
```

## Usage of prototypes

Use a prototype as the end node of definition. For example:

```js
import { Dict, Int, Null } from 'tyshemo'

const some = new Dict({
  name: String,
  age: Int,
  body: Null,
})
```

Here, `String` and `Int` `Null` has the same level meaning.

## Custom Prototype

You can create your own prototype by using tyshemo's `Prototype` class.

```js
import { Prototype } from 'tyshemo'
```

**Way 1: instance**

```js
const SomePrototype = new Prototype({
  name: 'some',
  validate: v => v === 'some',
})

const SomeType = new Dict({
  // use prototype instance directly in Type
  a: SomePrototype,
})
```

You should pass `validate` into it when initialize.

**Way 2: register**

To re-use prototype more conveniently, you can register some prototype with a validator.

```js
Prototype.register(proto, validator)
```

- proto: any type of value
- validator: a function to return true or false, true to match the prototype, false to not

i.e.

```js
// replace Promise
// before: v instance of Promise
// after: v has then&catch
Prototype.register(Promise, (v) => {
  return v && typeof v === 'object' && typeof v.then === 'function' && typeof v.catch === 'function'
})
```

Now, when you use `Promise` as prototype, tyshemo will use new validator to check:

```js
const SomeType = new Dict({
  some: Promise,
})
```

You can even define string/number prototype:

```js
Prototype.register(':some', SomePrototype)
```

Now you can use like this:

```js
const SomeType = new Dict({
  some: ':some', // which is in fact to be SomePrototype
})
```

*Notice: NaN can not be re-registered.*

Even though you do not need this almost time, please remember this, because you may need it someday.
