# Type

`Type` `Dict` `List` and `Tuple` are constructors called by new.

## Usage

In TySheMo, the basic class constructor is `Type`, which is extended to `Dict` `List` `Enum` and `Tuple`.

You can create a Type instance:

```js
import { Type } from 'tyshemo'
const SomeType = new Type(String)
// so that you can use methods' feature with SomeType
```

In Type, an object will be convert to Dict, and an array will be convert to List. For example:

```js
const SomeType = new Type({
  name: String,
  age: Number,
  body: {
    head: Object,
    hands: [Object],
    feet: [Object],
  },
})
```

It is the same with:

```js
const SomeType = new Dict({
  name: String,
  age: Number,
  body: new Dict({
    head: Object,
    hands: new List([Object]),
    feet: new List([Object]),
  }),
})
```

A `Type` instance have members:

**assert(value)**

Assert whether the `value` match the type.
If not match, it will use `throw TypeError` to break the program.
Return undefined.

**test(value)**

Assert whether the `value` match the type.
Return true if match, return false if not match.

**catch(value)**

Assert whether the `value` match the type.
Return null if match, and return error object if not match.

```js
let error = PersonType.catch(person)
```

**track(value)**

Assert whether the args match the type.
Return a Promise, if not match, rejects with an error, if match resolves.

```js
const SomeType = dict({
  name: String,
  age: Number,
})
const some = {
  name: 'tomy',
  age: 10,
}

SomeType.track(some).then(() => console.log('ok')).catch(error => console.log(error))
```

**trace(value)**

Assert (asynchronously) whether the `value` match the type.
Return a Promise, if not match, rejects with an error, if match resolves.

```js
SomeType.trace(some).then(() => console.log('ok')).catch(error => console.log(error))
```

*The difference between `track` and `trace` is `trace` will validate parameters asynchronously, so that if you change the data after trace, it may cause validate failure.*


**toBeStrict()/strict/Strict**

Whether use strict mode, default mode is false.
If you use strict mode, object properties count should match, array length should match, even you use `ifexist`.

```js
const MyType = new List([Number, Number])
MyType.Strict.assert([1]) // array length should be 2, but here just passed only one

const MyType = dict({
  name: String,
  age: Number,
})
MyType.Strict.assert({
  name: 'tomy',
  age: 10,
  height: 172, // this property is not defined in type, so assert will throw an error
})
```

However, `MyType.Strict` is different from `MyType.toBeStrict()`, `.toBeStrict()` is to covert current instance to be in strict mode, but `.Strict` or `.strict` will get a _new_ instance which is in strict mode. If you want to use a type instance only once in strict mode, you can use `.toBeStrict()`, if you want to use multiple times, use `.Strict` instead.

```js
const MyType = dict({
  body: dict({
    head: Object,
  }).toBeStrict(), // here I will use Dict directly in strict mode
})
```

## Dict/List/Enum/Tuple

These 4 types of data structure is extended from `Type`. So they have the same methods with `Type`.

+-------------+----------+----------+--
| TySheMo  |    JS    |  Python  |
+-------------+----------+----------+--
|    Dict     |  Object  |   dict   |
+-------------+----------+----------+-------------------
|    List     |  Array   |   list   |  mutable array
+-------------+----------+----------+--------------------
|    Enum     |   Set    |   set    |
+-------------+----------+----------+-------------------
|    Tuple    |          |   tuple  |  immutable array
+-------------+----------+----------+-------------------

### Dict

```js
const DictType = Dict({
  name: String,
  age: Number,
})
```

You can pass nested object, but are recommended to use another Dict instead:

```js
const BodyType = Dict({
  head: Object,
  foot: Object,
  body: {
    head: Object,
    hands: [Object],
    feet: [Object],
  },
})
const PersonType = Dict({
  name: String,
  age: Number,
  body: BodyType,
})
```

_What's the difference between Dict and Object?_

An Object match any structure of object. However, a Dict match certain structure of object.

You can use `dict` function to create Dict quickly:

```js
import { dict } from 'tyshemo'

const SomeDictType = dict({
  name: String,
  age: Number,
})
```

As known, `list()` `tuple()` and `enumerate()` are available.

Dict has 3 more methods:

**extend**

To create a new dict based on current.

```js
const SomeType = new Dict({
  name: String,
})
const Some2Type = SomeType.extend({
  age: Number,
})
```

It is the same as:

```js
const Some2Type = new Dict({
  name: String,
  age: Number,
})
```

**extract**

To create a new dict which is based on extracting from current dict.

```js
const SomeType = new Dict({
  name: String,
  age: Number,
})
const Some2Type = SomeType.extract({
  name: true,
})
// Some2Type only uses name property
```

**mix**

To create a new dict based on current dict.

```js
const SomeType = new Dict({
  home: { name: String },
  neighbor: { name: String },
})
const Some2Type = SomeType.mix({
  home: true,
  town: { name: String },
})
// Some2Type will have `home` and `twon`
```

Notice: mix only works for those properties whose value is object.


### List

A list is an array in which each item has some structure.

```js
const StringListType = new List([String])
```

It receive an array.

The length does not need to be stable.
However, the assert value should be one of the given types like using `enumerate`.

```js
const ListType = new List([String, Number])
ListType.test(['string', 1]) // true
ListType.test([1, 'string']) // true
ListType.test(['string', 1, 'string']) // true
ListType.test(['string', 1, 1]) // true
ListType.test(['string', 1, null]) // false
```

_What's the difference between List and Array?_

An Array match any structure for its item. However, a List match certain structure for each item. And a List has order and type limited.

### Tuple

A tuple is a group of items with certain order, the length of tuple can not be changed.

```js
const ParamsType = Tuple([Object, Number, String])
ParamsType.test([{}, 1, 'ok']) // true
```

The assert value should have same length and type as `ParamsType` defined.

_What's the difference between Tuple and List?_

List items' length is not stable, a List can contains any amount items.
But a Tuple should have stable length.

List items should match given types in order, and the overflowed ones should match one of the given types.
Tuple items should match the data type on each index.

### Enum

An Enum is a set of values from which the given value should pick.


```js
const ColorType = new Enum(['red', 'white', 'green'])
ColorType.test('black') // false
```

```js
const SomeType = new Enum([String, Number])
SomeType.test('black') // true
SomeType.test(2) // true
SomeType.test([]) // false
```

## Extending Type

How to create a new type? Just extend from Type and override `assert` method:

```js
class RangeType extends Type {
  assert(value) {
    const pattern = this.pattern

    if (!Array.isArray(pattern)) {
      throw new Error('pattern should be an array.')
    }
    if (typeof value !== 'number' || isNaN(value)) {
      throw new Error('value should be a number.')
    }

    const [min, max] = pattern
    if (value < min || value > max) {
      throw new Error(`value should be in range [${min}, ${max}]`)
    }
  }
}

const SomeType = new RangeType([10, 20])
SomeType.test(11) // true
SomeType.test(221) // false
```

`assert` method should throw an error.
