# Schema

Schema is a definition system for describing data specifications.
With a schema, you can clearly know an object's structure, changing rules, type, validation rules and formatting rules. In fact, with a schema, you will almost know all about the dynamic changes of the given object.

However, because schema is to describe data, so it is stateless. You should always use its methods to generate what you want. In a glance, it is like a factory.

## Usage

```js
import { Schema, Meta } from 'tyshemo'

class Name extends Meta {
  static default = 'unknown'
  static type = String
}

class Age extends Meta {
  static default = 0
  static type = Number
}

const schema = new Schema({
  name: new Name(),
  age: new Age(),
})
```

To create a schema instance, you should pass an object parameter to define the data structure and inner rules.
The definition object contains all needed fields of data.
And the property of the definition object should be a Meta whose attributes will be used by Schema to build up fields' rules.

The following written way are supported too:

```js
const schema = new Schema({
  name: Name,
  age: Age,
})
```

```js
const schema = new Schema({
  name: {
    default: 'unknown',
    type: String,
  },
  age: {
    default: 0,
    type: Number,
  },
})
```

## Recommend

Notice, you may never use `Schema` alone, you should always use it with `Model`. Read [document of Model](model.md) to learn more.

In fact, we are not recommend to use Schema directly, it is always used with `Model`, I do not think use Schema as a factory will help you, but you should know the usage so that one day when you need you can use.
