# ModelParser

To parse a model from a json.

## Usage

```js
import { ModelParser } from 'tyshemo-x'
const parser = new ModelParser()

const json = {
  name: {
    default: 'tomy',
    type: 'string',
    required: 'age > 10',
  },
  age: {
    default: 10,
    type: 'number',
  },
}
const SomeMode = parser.parse(json)
```

The instance of ModelParser has only `parse` method. The method receive a json and return a Model.

## JSON Schema

The json is a description of model's schema. The structure of the json is the same as model's schema definition.
However, it is not possible to transfer instances of classes by http, we can not create a schema property with default value as a function or a instance of some class. Only primative types can be used here.

**computed expression**

To describe functions for schema properties, such as required, map, flat and so on, these properties are treated as computed expression.

```json
{
  "name": {
    "default": "tomy",
    "type": "string",
    "required": "age > 10" // notice here, `required: "age > 10"` means `required() { return this.age > 10 }`
  },
  "age": {
    "default": 10,
    "type": "number"
  }
}
```

The following items are using computed expression:

- compute
- required
- readonly
- disabled
- hidden
- drop
- map
- flat

The following items are using special computed expression with `$value`:

- getter
- setter
- validators
  - determine
  - validate
  - message

For example:

```json
{
  "age": {
    "default": 10,
    "type": "number"
  },
  "weight": {
    "default": 40,
    "setter": "+$value" // means `setter(value) { return + value }`
  }
}
```

The following items are using special computed expression with `$data`:

- create

```json
{
  "age": {
    "default": 10,
    "type": "number"
  },
  "weight": {
    "default": 40,
    "create": "$data.s_weight" // means `create(data) { return + data.s_weight }`
  }
}
```

And, in computed expression, you should use `''` to wrapper a normal string. For example, if you want required to return a string, you should must wrap the string in `''`:

```json
{
  "age": {
    "default": 10,
    "type": "number",
    "required": "'age is required'" // means `required() { return 'age is required' }`
  }
}
```

Notice that, it is impossible to generate complex Model by using ModelParser.
