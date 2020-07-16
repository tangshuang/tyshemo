# Type

Type is to describe data's storage structure and compute characteristic.

We have 6 types in tyshemo, they are `Dict` `List` `Tuple` `Enum` `Range` `Mapping`. And they are all extended from `Type` which is the basic class.

## Type

As the basic class, `Type` is container which is based on prototype. You should pass prototypes into `Type` to initialize.

```js
const SomeType = new Type(String)
```

However, we do almostly never use `Type` directly, we use `Dict` `List` and so on instead.

### assert

`assert` method of a instance of `Type` is to determine whether the value match the type.

```js
import { Dict } from 'tyshemo'

const SomeDict = new Dict({
  name: String,
  age: Number,
})

SomeDict.assert({
  name: 'tomy',
  age: 10,
})
```

`assert` returns nothing. When assert failing, tyshemo use `throw` to throw an Erorr.

### catch

`catch` method get the output Error when validate the value.

```js
const error = SomeDict.catch({
  name: 'tomy',
  age: 10,
})
```

### test

`test` method returns true or false to determine whether the validation pass.

```js
const data = {
  name: 'some',
  age: 0,
}
if (SomeDict.test(data)) {
  // do something
}
```

### track

`track` method is like `catch` but returns a Promise, you can catch the Error in `.catch`:

```js
SomeDict.track({
  name: null,
}).catch(error => console.log(error))
```

### trace

`trace` method is like `track` which returns a Promise too. However, `trace` validate value in an async task, so that it will not break current executing.

### Strict/strict/toBeStrict

`Strict` is all the same as `strict`. It is a property, from which you can get a new `Type` in strict mode:

- `Dict` should fully match properties, properties should not more or less than defined
- `ifexist` has no effect

`toBeStrict` is a method which turns the current `Type` to be or not to be in strict mode, pass `true` or `false` into it.

```js
SomeDict.toBeStrict(true)
```

## Dict

Like in python, `Dict` is an object with key-value structure. `Dict` is the most used type in your projects.

```js
const SomeDict = new Dict({
  name: String, // use native prototype
  age: 10, // use certain value
})
const OtherDict = new Dict({
  some: SomeDict, // defined type
  other: ifexist(SomeDict), // use rule
})
```

`Dict` is extended from `Type`, so it has all methods of `Type`. However, it has its own methods:

### extend

Create a new `Dict` by extending the original definition.

```js
const Some2Dict = SomeDict.extend({
  age: Numeric, // override
  height: Number, // add
})
```

### extract

Create a new `Dict` by extracting from original definition.

```js
const Some3Dict = Some2Dict.extract({
  name: true,
  height: true,
})
```

If you need some properties, pass them into extract and set them to be `true`.

## List

`List` is to describe array. You can use `List` to assert a value with certain inner structure.

```js
const SomeList = new List([SomeDict])
```

So that, an array should must have items whose inner structure should must match `SomeDict`.

If there are several types in the `List` parameter list, it means the items of the array can be one of this types (enumerate).

```js
const SomeList = new List([SomeDict, Some2Dict])
```

## Tuple

`Tuple` is to describe array whose items are limited by certain types.

```js
const SomeTupe = new Tuple([String, Number])
```

It means an array should must have only two items, the first should be string, and the second should be number.

When we want to check the parameters of a function, `Tuple` is the best choice.

```js
function some(...args) {
  SomeTuple.assert(args)
}
```

## Enum

`Enum` is to describe data which can only be one of given value/types.

```js
const SomeEnum = new Enum([Number, Numeric]) // the value should only be number or string
const ColorEnum = new Enum(['red', 'green', 'blue']) // the value should only be 'read' 'green' or 'blue'
```

## Range

`Range` is to describe a number which should must be in the given range.

```js
const SomePercent = new Range({
  min: 0,
  max: 100,
  minBound: true, // whether contains the min, default true
  maxBound: false, // whether contains the max, default true
})
```

## Mapping

`Mapping` is to describe an object whose key-value should keep in certain structure.

```js
const SomeMapping = new Mapping({
  key: Numeric, // type of key
  value: Number, // type of value
})
```

## SelfRef

`SelfRef` is a special type, in some cases, you may reuse your will-defined type inside itself.

```js
const SomeType = new Dict({
  name: String,
  children: [SomeType], // child structure is the same with itself
})
```

However, this is not working as you want, because `SomeType` has not been defined before you use it in Dict.

In this situation, you should use `SelfRef`:

```js
const SomeType = new SelfRef((SomeType) => {
  return new Dict({
    name: String,
    children: [SomeType],
  })
})
```

In this code block, `SomeType` points to `SomeType`. It will work as you want.

## short import

To use more conveniently， you can import these types from tyshemo with functions:

```js
import { dict, list, tuple, enumerate, range, mapping, selfref } from 'tyshemo'

const SomeDict = dict({
  name: String,
  age: Number,
})
```

So that, you do not need to write `new` any more.
