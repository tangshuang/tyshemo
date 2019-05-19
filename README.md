TySheMo
=======

An ECMAScript data type/schema system which based on data type validation.

- [API DOC](./docs)
- [中文文档](https://www.tangshuang.net/5625.html)

TySheMo is a js runtime data type/schema system, which contains 4 parts: Rule, Type, Schema and Model.
You can use TySheMo to:

- define your own data type
- validate data structure
- formulate data
- watch data change
- formulate data from backend to frontend

## Install

```
npm i tyshemo
```

## Usage

```js
import { Rule, Type, Schema, Model } from 'tyshemo'
```

or

```js
const { Ty } = require('tyshemo')
```

or

```html
<script src="/node_modules/tyshemo/dist/bundle.js"></script>
<script>
const { Ty } = window['tyshemo']
</script>
```

If you want to use some sub modules, you can use files in `dist` dir.

```js
import Dict from 'tyshemo/dist/dict.js'
```

## Concepts

Before we develop, we should learn about 4 concepts.

### Rule

A `Rule` is a Behavior Definition of an automic data.
For example, `var a = 10` and we know `a` is a number.
But how do you know `a` is a number which will be stored/computed as number type by V8? And how do you know a variable is a what behavior definition?

We have native prototypes/definition used by TySheMo:

- String
- Number: should be a finite number, not match `NaN` `"123"` and `Infinity`
- Boolean: should be one of `true` or `false`
- Object: should be a normal object like `{}`, not match instance of class, array and Object self
- Array: should be a normal array like `[]`, not match instance of class inherited from Array and Array self
- Function
- RegExp: should be a string match regexp
- Symbol: should be a symbol
- NaN
- Infinity
- Date
- Promise

But these do not contains all of what we want, we want more.
Now you can use Rule to define a behavior definition of a variable.

And we extended so that we now have:

- Int
- Float
- Numeric: number or number string
- Null
- Undefined
- Any

And to use `Rule` conveniently, we provide functions to generate rules:

- asynchronous(async fn:type)
- validate(fn, msg)
- match(...types)
- ifexist(type)
- ifnotmatch(type, defaultValue)
- determine(fn:type)
- shouldexist(fn, type)
- shouldnotexist(fn)
- implement(Constructor)
- equal(value)
- lambda(inputType, outputType)

After you learn the usage of `Rule`, you can define your own rule to create new definition.

```js
// example
import { Rule } from 'tyshemo'
export const NumberString = new Rule('NumberString', value => typeof value === 'string' && /^\-?[0-9]+(\.{0,1}[0-9]+){0,1}$/.test(value))
```

### Type

A `Type` is a data nature, quality or characteristic.
You call a data as some type data, it means you know what genera it belongs to.
For example, you call a boy as a Person, because you know the boy has what a Person should contains: a head, two hands and may talk.
In summary, Type contains the data behavior definition, the data structure and the ability to maintain data change as defined.
So a Type has the ability to check and trace data's characteristic, and throw out warn to user if the data is not of current Type.

To create a type, you can use:

- new Type(pattern)

And we have define some data structure:

- new Dict({ ... })
- new List([ ... ])
- new Tuple([ ... ])
- new Enum([ ... ])

```
+-------------+----------+----------+--
|    TySheMo  |    JS    |  Python  |
+=============+==========+==========+==
|    Dict     |  Object  |   dict   |
+-------------+----------+----------+-------------------
|    List     |  Array   |   list   |  mutable array
+-------------+----------+----------+--------------------
|    Enum     |   Set    |   set    |
+-------------+----------+----------+-------------------
|    Tuple    |          |   tuple  |  immutable determined array
+-------------+----------+----------+------------------------------
```

The output of these constructors are all types which can be used in our system.
And these 4 types are extended from `Type`.
Later I will tell you how to create type by using these constructors.

And to use `Type` conveniently, we provide functions to generate types:

- type(pattern)
- dict({ ... })
- list([ ... ])
- tuple([ ... ])
- enumerate([ ... ])

**Pattern**

To define a type, you should provide data behavior definition and data structure, these make up a Pattern.
A Pattern is what passed into `Type` constructors.

```js
const SomePattern = {
  name: String,
  age: Number,
  code: NumberString, // Rule
  books: BooksListType, // Type
}
const SomeType = new Dict(SomePattern)
```

Pattern is the design of type to implement the type's ability.
You can use js native prototypes/class/value or Rule or Type in a Pattern.
And different type constructor need different pattern form.

### Schema

A Schema is to describe data structure interaction logic.
In javascript, we use object to reflect data set which contains fields, so in TySheMo you should use object to define Schema.

A schema do not care the real data, it is no-state, it creates a abstract data structure to validate and formulate data.

```js
const PersonSchema = new Schema({
  name: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
    default: 0,
  },
  sex: {
    type: Number,
    default: 'M',
  },
  code: {
    type: NumberString,
    default: '0',
  },
})

fetch('xxx')
  .then(res => res.json())
  .then(data => PersonSchema.ensure(data))
  .then(data => console.log(data))
  // final data will have PersonSchema data structure whatever the backend data's structure is.
  // you can use the final data without worry
```

### Model

A model is a data container which provide features about data operation.
We always use a model in our business code to use data.
Js native data is very weak, we provide a model that you can watch data change, so that you can make your business logic more clear.

- watch data change
- computed property
- validate
- extract formdata

Model is used to create controllable data, it always used in bussiness code and we do not know how developers will use a model.
To define a model, you should provide a schema. To implement this, you should extend `Model` and give you own schema method to return a schema.

```js
import { Model, Enum } from 'tyshemo'

class CarModel extends Model {
  schema(Schema) {
    return new Schema({
      color: {
        type: new Enum(['red', 'blue', 'yellow']),
        default: 'red',
      },
    })
  }
}
```

The relationship of `Rule` `Type` `Schema` and `Model`:

```
+---------------------+
|  Native Prototypes  |
+=====================+
|                     |
|  String             |
|  Number             |
|  Array              |  -----------+
|  Object             |             |
|  Function           |             |        +----------------+
|  Symbol             |             |        |  Type          |           +----------------+
|  ...                |             |        +================+           |  Schema        |
|                     |             |        |                |           +================+         +-------------+
+---------------------+             |        |  Dict          |           |                |         |             |
                                    +----->  |  List          |  ------>  |  Property1     |  ---->  |    Model    |
+---------------------+             |        |  Tuple         |           |  Property2     |         |             |
|  Rule               |             |        |  Enum          |           |  Property3     |         +-------------+
+=====================+             |        |  ....          |           |                |
|                     |             |        |                |           +----------------+
|  Any                |             |        +----------------+
|  Null               |             |
|  Undefined          |  -----------+
|  Int                |
|  Float              |
|  Numeric            |
|  ...                |
|                     |
+---------------------+
```

## MIT License

Copyright 2019 tangshuang

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
