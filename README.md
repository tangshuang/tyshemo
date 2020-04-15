TySheMo
=======

TySheMo is a javascript RUNTIME data type and structure description system. It provides different level of objects to describe data's type and structure, and make it easy to ensure data type in complex js business. Different from other type system, TySheMo provides a atomic programing practice to build a data type system (checker). Based on its type description system, it provides very easy validation approach and uppredictable checking rules or methods. And, the most creative highlight thing is that, TySheMo provides a type basic model which is easy to control data change, vlaidation and formulation.

- [中文文档](https://www.tangshuang.net/7101.html)

## Install & Usage

You can use tyshemo with npm or cdn.

NPM:

```
npm i tyshemo
```

```js
import { Ty } from 'tyshemo'
```

```js
const { Ty } = require('tyshemo')
```

If you want to load on demand:

```js
const { Ty } = require('tyshemo/cjs/ty')
```

Or use source code to be benefit from tree shaking:

```js
import { Ty } from 'tyshemo/src/ty'
```

CDN:

```html
<script src="https://unpkg.com/tyshemo/dist/tyshemo.min.js"></script>
<script>
  const { Ty } = window.tyshemo
</script>
```


```html
<script src="https://unpkg.com/tyshemo/dist/ty.min.js"></script>
<script>
  const { Ty } = window.ty
</script>
```


```html
<script src="https://unpkg.com/tyshemo/dist/store.min.js"></script>
<script>
  const { Store } = window.store
</script>
```

## Concepts

Before we develop, we should learn about the following concepts.

### Prototype

Prototype is to describe data automic type which points out the data's nature, quality or characteristic.

In TySheMo, we do not need to describe the deep theory, we just need to define a way to check whether the given data matches the given prototype.

We use native definition/interface as prototypes:

- String: should be a string
- Number: should be a finite number, not match `NaN` `"123"`
- Boolean: should be `true` or `false`
- Object: should be a normal object like `{}`, not match instances, array and Object self
- Array: should be a normal array like `[]`
- Function: should be a function
- regexp: should be a string which match regexp
- Symbol: should be a symbol
- NaN: should be NaN
- Infinity: should be infinity
- Date: should be an instanceof Data (new Date)
- Promise: should be an instance of Promise (new Promise)

In fact, all classes can be a prototype, even the custom classes which are defined by yourself.

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

### Type

Type is to describe data structure type definition which points out the data storage and usage.

In TySheMo, we do not need to implement data structure in deep theory, we just need to define a way to check whether the given data match the given type.

We have defined types:

- Dict
- List
- Tuple
- Enum
- Range
- Mapping

### Rule

Rule is to describe the behaviour methods of object properties.

In TySheMo, we have defined rules:

- asynch: check later
- match: match multiple
- determine: determine which type to check
- shouldmatch: should match the given type, or throw out the given message
- shouldnotmatch: should not match the given type, or throw out the given message
- ifexist: if the property exists, check, if not exists, do not check
- ifnotmatch: if the property does not match the given type, use the given data to replace the property
- shouldexist: determine whether the property should exist, if exists, check with the given type
- shouldnotexist: determine whether the property should not exist
- instance: the property should be an instance of the given class
- equal: the property should deep equal the given value
- nullable: can be null or what you passed into
- lambda: the property should be a function, and the input and output should match the given types

### Schema

Schema is to describe data structure in which you describe each property's interaction logic, such as default value, type, rule, computing and so on.

A schema does not care the real data, it is non-statable, it creates a abstract data structure to validate and formulate data.

In TySheMo, a schema is defined like:

```
{
  name: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
    default: 0,
  },
}
```

### Model

Model is a data container which provide features about data operation.

Js native data is very weak, we provide a model that you can watch data change, so that you can make your business logic more clear. We always use a model in our business code to matain data.

And it is a observable object, you can watch properties's changing, and run some callback functions.

### Store

Store is a state container, which manage state following observer pattern.

In TySheMo, each model has a store inside itself to storage and watch data. However, you can use it as a single part for other system.

## MIT License

Copyright 2019 tangshuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
