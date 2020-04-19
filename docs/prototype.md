# Prototype

Prototype is to describe data automic type which points out the data's nature, quality or characteristic.

In TySheMo, we do not need to describe the deep theory, we just need to define a way to check whether the given value matches the given prototype.

## Native Prototypes

We use native definition/interface as prototypes:

- String: should be a string
- Number: should be a finite number, not match `NaN` `"123"`
- Boolean: should be `true` or `false`
- Object: should be a normal object like `{}`, not match instances, array and Object self
- Array: should be a normal array like `[]`
- Function: should be a function
- regexp: should be a string which match regexp
- Symbol: should be a symbol
- NaN: should be number and NaN
- Infinity: should be infinity
- Date: should be an instanceof Data (new Date)
- Promise: should be an instance of Promise (new Promise)

In fact, all classes can be a prototype, even the custom classes which are defined by yourself.

## Internal Prototypes

And we extended some prototypes:

- Int
- Float
- Negative
- Positive
- Finity
- Zero
- Numeric: number string
- String8: string max-length 8
- String16
- String32
- String64
- String128
- Null: null
- Undefined: undefined
- Any

## Custom Prototype

You can define your own prototype by using tyshemo's `Prototype` interface.

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
  some: SomePrototype,
})
```

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
