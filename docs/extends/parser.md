# Parser

> Notice, Parser is not in tyshemo core package any more, we will provide a pacakge called `tyshemo-extends`.

Based on tyshemo's type system, I build a type text description system ([IDL](idl.md)), and this system can be parsed by `Parser`.

## Usage

```js
import { Parser } from 'tyshemo-extends'

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

## Custom Types Text

However, the previous default type descirption texts are not enough for you, and you want to define your own types, you can implement with 3 ways:

**Parser.defaultTypes**

Change `Parser.defaultTypes` directly, this way is the fast, but will pollute all Parser instances.

**instance types**

When you initailize a Parser, you can pass a types mapping object into Parser.

```js
// create my own types
const types = {
  some: new Tuple([String, Number]),
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
