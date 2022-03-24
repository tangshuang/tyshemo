# Parser

Based on tyshemo's type system, I build a type text description system, and this system can be parsed by `Parser`.

## JSON IDL

Now, let's learn a new symbol system, or another said way, IDL (Interactive Data Language).

> JSON is the best data format to send between backend api and frontend, so we choose JSON as our IDL protocol.

To describe a data's structure and each node's data type, we use a json file to write text to.

```json
{
  "__def__": [
    {
      "name": "book",
      "def": {
        "name": "string",
        "price": "float"
      }
    }
  ],
  "name": "string",
  "age": "number",
  "has_football": "?boolean",
  "sex": "M|F",
  "dot": "='xxx'",
  "belong": "?='animal'",
  "vioce": "!number",
  "num": "string,numeric",
  "parents": "(string,string)",
  "books": [
    {
      "name": "string",
      "age": "number"
    }
  ],
  "body": {
    "head": "boolean",
    "neck": "boolean"
  }
}
```

I think you are easy to understand what I was describing from the previous json text.
Well, this is the IDL of tyshemo's type system.

The grammar is very easy:

```json
{
  "property_name": "type or rule expression"
}
```

### Type Expression

- List:
  - `"string[]"` this property is a list of strings
  - `"[string]"` the same as `string[]`.
  - `"[string|number]"` this property is a list of item which may be string or number
  - `["string"]` the same as `string[]`
  - `["string", "number"]` the same as `"[string|number]"`
- Enum: `"string|number"`, use a `|` to split type string
- Tupl: `"(string,number)"`, use `()` to wrap up. Notice, there should no space after `,`, the words should follow by follow.
- Dict: `{...}`, just use a sub-object to stand for dict.
- Mapping: `"{numeric:string}"`, use `{}` to wrap up, words before `:` is the type of key, after `:` is  the type of value.
- Range:
  - `"10<->20"` contains both bound
  - `"10->20"` only contains max(20), not contains min(10)
  - `"10<-20"` only contains min(10), not contains max(20)
  - `"10-20"` neither contains max nor min

### Rule Expression

Currently only supports rules:

- ifexist: `?` at the first letter of expression, `"?string"`
- nonable: `&` at the first letter of expression, `"&string"`
- equal: `=` at the first letter, `"='it is a dog'"`
- shouldnotmatch: `!` at the first letter, `"!string"`
- match: `,` to link several expression, for example `"string,numeric"` means the property should must be a string and must be a numeric

Almostly, `?` `&` and `!` will not use together; `?` and `!` come before `=`.

In some case, you need to use an object or an array to stand for type, and want a rule, you can put the rule symbols into propert name:

```
{
  "name&": "string",
  "age?": "number",
  "weight?&": "number",
  "some!": "string",
  "dog?": {
    "name": "string",
    "age": "number"
  }
}
```

And in this time, we have two more rule exp:

- enumerate: `|`, value should be an array
- tuple: `*`, value should be an array

```
{
  "color|": ["'blue'", "'red'", "'yellow'"], // be one of the given colors
  "sum*": ["number", "number"] // should be an array, and two items should be number
}
```


*The priority of Type Expression is higher than Rule Expression. So when you use `,` to conbime to expression, they will be treated as types firstly.*

### Types Text

We can use `string` for `String`, and `infinity` for `Infinity` is because we have defined the text symbol of a type in `Parser`.

```js
Parser.defaultTypes = {
  string: String,
  number: Number,
  boolean: Boolean,
  null: Null,
  undefined: Undefined,
  none: None,
  symbol: Symbol,
  function: Function,
  array: Array,
  object: Object,
  numeric: Numeric,
  int: Int,
  float: Float,
  negative: Negative,
  positive: Positive,
  zero: Zero,
  any: Any,
  nn: NaN,
  infinity: Infinity,
  finity: Finity,
  date: Date,
  promise: Promise,
  error: Error,
  regexp: RegExp,
}
```

### What does `__def__` mean?

In the previous json text, you can find `__def__` property. This is a sepcail property, which is not to describe property, it is a dinition set of types. It is an array whose inner items structure is:

```json
{
  "name": "book",
  "def": {
    "name": "string",
    "price": "float"
  }
}
```

- name: the type text to be used in real description
- def: the real description of this type

When we describe a property as `book`, in fact we are describe it is an object which is `{ name: string, price: float }`.

And you should know that, `__def__` is an array, items has order, some def object may use the ones which are defined before it be called. So, you should make the order right in `__def__`.

### Comments

The properties which begin with `#` will be used as these properties' comments.

```json
{
  "#name": "comment for name",
  "name": "string"
}
```

```json
{
  "body": {
    "#hand": "comment for body.hand",
    "hand": "boolean",
    "foot": "boolean"
  },
  "#books[0]": "we can not comment for an item of array, so have to do like this",
  "books": [
    {
      "price": "number"
    }
  ],
  "#body.foot": "we can comment for deep object properties"
}
```

## Usage

```js
import { Parser } from 'tyshemo'

const parser = new Parser()
const SomeType = new Dict({
  name: String,
  age: Number,
})

const description = parser.describe(SomeType)
// => json { "name": "string", "age": "number" }

const type = parser.parse(json)
// => Dict instance
```

**guess**

Guess type description from a exisiting data.

```js
const data = {
  name: 'tomy',
  age: 10,
  books: [
    {
      title: 'Told Sad',
      price: 12.5,
    },
  ],
}

const description = parser.guess(data)
// -> json { "name": "string", "age": "number" ... }

const type = parser.parse(description)
// -> Dict
```

**merge**

Guess type description, and merge it into existing description to create a new one.

```js
const next = {
  name: null,
}

const description2 = parser.merge(description, next)
// -> json { "name&": "string", "age?": "number" ... }
// name is nullable, age can not exist

const type = parser.parse(description2)
// -> Dict
```

## Custom Types Text

However, the previous default type descirption texts are not enough for you, and you want to define your own types, you can implement with 3 ways:

**Parser.defaultTypes**

Change `Parser.defaultTypes` directly, this way is the fast, but will pollute all Parser instances.

**instance types**

When you initailize a Parser, you can pass a types mapping object into Parser.

```js
// create my own types
const types = {
  some: new Tupl([String, Number]),
}

// pass it as initialize parameter
const parser = new Parser(types)

// now you can use your own types in this Parser instance
parser.parse({
  list: "some",
})
```

**dynamic define**

If you have a created instance of Parser, you can invoke `define` method to patch you own type.

```js
parser.define('some', SomeType)
```

Then you can use `some` text in the JSON IDL by this parser to parse.
