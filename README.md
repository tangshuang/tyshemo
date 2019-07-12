TySheMo
=======

An ECMAScript data type/schema describe system.

- [API DOC](./docs)
- [中文文档](https://www.tangshuang.net/7101.html)

TySheMo is a js runtime data type/schema describe system, which contains 5 parts: Prototype, Rule, Type, Schema and Model.

You can use TySheMo for:

- data type and structure checking
- model schema
- formulated data
- data change watcher
- responsive data model

## Install

```
npm i tyshemo
```

## Usage

webpack:

```js
import { Ty } from 'tyshemo'
```

ES:

```js
import { Ty } from 'tyshemo/src/index.js'
```

commonjs:

```js
const { Ty } = require('tyshemo')
```

bundle file (umd):

```html
<script src="/node_modules/tyshemo/dist/bundle.js"></script>
<script>
const { Ty } = window['tyshemo']
</script>
```

If you want to use some sub modules, you can use files in `dist` dir.

```js
const { Dict } = require('tyshemo/dist/dict.js')
```

or use source code:

```js
import Dict from 'tyshemo/src/dict.js'
```

## Concepts

Before we develop, we should learn about 5 concepts.

### Prototype

Prototype is to describe data automic type which points out the data's nature, quality or characteristic.

For example, `var a = 10` and we know `a` is a number.
But how do you know `a` is a number which will be stored/computed as number type by V8?
This is defined by prototype.

In TySheMo, we do not need to describe the deep theory, we just need to define a way to check whether the given data matches the given prototype.

We use native definition/interface as prototypes:

- String: should be a string
- Number: should be a finite number, not match `NaN` `"123"`
- Boolean: should be `true` or `false`
- Object: should be a normal object like `{}`, not match instances, array and Object self
- Array: should be a normal array like `[]`
- Function: should be a function
- RegExp: should be a string which match regexp
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
- Numeric: string which is number
- Null
- Undefined
- Any: any value in javascript

However, these do not contains all of what we want, we want more.
After you learn more about `Prototype`, you will be able to extend your own prototypes.

### Type

Type is to describe data structure type definition which points out the data storage and usage.

You call a data as some type of data, it means you know what genera it belongs to.
For example, you call a boy as a Person, because you know the boy has what a Person should contains: a head, two hands and may talk.
In summary, type contains the data structure definition and the ability to maintain data change as defined (or to throw error when you operate in way which is not allowed).

In TySheMo, we do not need to implement data structure in deep theory, we just need to define a way to check whether the given data match the given type.

We have defined types:

- Dict
- List
- Tuple
- Enum
- Range

```
+-------------+----------+----------+--
|    TySheMo  |    JS    |  Python  |
+=============+==========+==========+==
|    Dict     |  Object  |   dict   |
+-------------+----------+----------+------------------------------
|    List     |  Array   |   list   |  mutable array
+-------------+----------+----------+------------------------------
|    Enum     |          |          |  should be one of given items
+-------------+----------+----------+------------------------------
|    Tuple    |          |   tuple  |  immutable determined array
+-------------+----------+----------+------------------------------
|    Range    |          |          |
+-------------+----------+----------+------------------------------
```

After you learn more about `Type`, you will be able to extend your own types.

### Rule

Rule is to describe the behaviour methods of object properties.
We need to know whether a property should exist, or whether a property should match some type.

In TySheMo, we have defined rules:

- asynchronous: check later
- match: match multiple
- determine: determine which type to check
- shouldmatch: should match the given type, or throw out the given message
- shouldnotmatch: should not match the given type, or throw out the given message
- ifexist: if the property exists, check, if not exists, do not check
- ifnotmatch: if the property does not match the given type, use the given data to replace the property
- shouldexist: determine whether the property should exist, if exists, check with the given type
- shouldnotexist: determine whether the property should not exist
- beof: the property should be an instance of the given class
- equal: the property should deep equal the given value
- lambda: the property should be a function, and the input and output should match the given types

After you learn more about `Rule`, you will be able to extend your own rules.

### Schema

Schema is to describe data structure in which you describe each property's interaction logic, such as default value, type, rule, computing and so on.

A schema does not care the real data, it is non-statable, it creates a abstract data structure to validate and formulate data.

In TySheMo, you should use the `Schema` class to create an instance so that you can use the ability to validate and formulate. Please read more about `Schema`.

### Model

Model is a data container which provide features about data operation.

Js native data is very weak, we provide a model that you can watch data change, so that you can make your business logic more clear. We always use a model in our business code to matain data.

- define data structure and type of each property
- ensure data to be in right types
- watch data change
- recover data from backend api
- create formdata/postdata

The relationship:

```
+-----------+      +-----------+       +-----------+      +------------+      +-----------+
| Prototype |  ->  |   Type    |  <->  |   Rule    |  ->  |   Schema   |  ->  |   Model   |
+-----------+      +-----------+       +-----------+      +------------+      +-----------+
```

Learn more about `Model` to use it.

## MIT License

Copyright 2019 tangshuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
