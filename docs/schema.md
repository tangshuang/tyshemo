# Schema

`Schema` should be created by new.

## Usage

```js
import { Schema } from 'tyshemo'
const SomeSchema = new Schema({
  prop1: {
    type: String,
    default: '',
  },
  prop2: SecondSchema,
  prop3: [ThridSchema],
})
```

The definition passed into Schema should be structed by *propertyName* and *propertyDefinition*, we support 3 kind of propertyDefinition:

- object (recommended)
  - type: pattern
  - default: the default value if not match type
- schema: an instance of Schema
- \[schema\]: an array of the passed Schema, only one schema acceptable

**validate**

Validate whether the passed data is fit the schema requriement.

- @param {object} data

```js
let error = SomeSchema.validate(data)
```

It will return an error if not pass, or will return null.

**ensure**

Create a data by passed data.
The output data will completely fit the schema.

```js
const output = SomeSchema.ensure(data)
```

**catch**

Catch the errors which thrown by `ensure`.
It is asynchronous.

```js
const output = SomeSchema.ensure(data)
SomeSchema.catch(errors => console.log(errors))
```
