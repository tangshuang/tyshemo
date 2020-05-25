# Schema

Schema is a definition system for describing data specifications.
With a schema, you can clearly know an object's structure, changing rules, type, validation rules and formatting rules. In fact, with a schema, you will almost know all about the dynamic changes of the given object.

However, because schema is to describe data, so it is stateless. You should always use its methods to generate what you want. In a glance, it is like a factory.

## Usage

```js
import { Schema } from 'tyshemo'

const schema = new Schema({
  name: {
    type: String,
    default: 'unknown',
  },
  age: {
    type: Number,
    default: 0,
  },
})
```

To create a schema instance, you should pass an object parameter to define the data structure and inner rules. The definition object contains all needed fields of data. Each property's name is to be the field's name, and the property value should be an object which contains the following options:

```js
const schema = new Schema({
  propertyName: {
    // required, function to return an object/array
    default: '',
    // optional, computed property, will compute at each time digest end
    // when it is a compute property, it is not able to use set to update value
    compute() {
      const a = this.a
      const b = this.b
      return a + '' + b
    },

    // optional, when passed, `set` action will return prev value if not pass type checking
    // notice: `default` and result of `compute` should match type,
    // can be rule, i.e. ifexist(String)
    type: String,
    message: '', // message to return when type checking fail

    // optional
    validators: [
      {
        determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
        validate: (value) => Boolean, // required, return true to pass, false to not pass
        message: '', // the message which throw when validate not pass, can be function to return message dynamicly
      },
    ],

    // optional, function, used by `parse`, `json` is the parameter of `parse`
    create: (json, key, value) => !!json.on_market ? json.listing : json.pending,

    // optional, function, whether to not use this property when formulate
    drop: (value, key, data) => Boolean,
    // optional, function, to override the property value when formulate, not work when `drop` is false
    map: (value, key, data) => newValue,
    // optional, function, to assign this result to output data, don't forget to set `drop` to be true if you want to drop original property
    flat: (value, key, data) => ({ newProp: newValue }),

    // optional, function, format this property value when get
    getter: (value) => newValue,
    // optional, function, format this property value when set
    setter: (value) => value,

    // optional, function or boolean or string, use schema.required(field) to check, will be invoked by validate
    required: () => Boolean,
    // optional, function or boolean or string, use schema.readonly(field) to check, will disable set
    readonly: () => Boolean,
    // optional, function or boolean or string, use schema.disabled(field) to check, will disable set/validate, and be dropped when formulate
    disabled: () => Boolean,
    // optional, function or boolean, use schema.hidden(field) to check whether the field should be hidden
    hidden: () => Boolean,

    // the difference between `disabled`, `readonly` and `hidden`:
    // readonly means the property can only be read/validate/formulate, but could not be changed.
    // disabled means the property can only be read, but could not be changed, and will be drop when validate and formulate
    // hidden means the property does not show in view, but can be changed and formulated

    // optional, when an error occurs caused by this property, what to do with the error
    catch: (error) => {},
  },
})
```

Notice, you may never use `Schema` alone, you should always use it with `Model`. Read [document of Model](model.md) to learn more.

## Methods

As said, you may use a stateless schema as a factory.

### required/readonly/disabled/hidden

These four methods return a boolean value to help determine whether the field should show in view, or throw an error when submit data.

```js
const isRequired = schema.required(key, this)
```

Notice the second parameter, it is required. It means which context you want to bind to in the defined `required` function. For example:

```js
const schema = new Schema({
  name: {
    default: '',
    required() {
      if (this.type === 'person') {
        return true
      }
      else {
        return false
      }
    },
  },
})


const obj = {
  type: 'person',
  name: '',
}
const isRequired = schema.required('name', obj) // false

if (isRequired && isEmpty(obj.name)) {
  console.error('name should not be empty')
}
```

As the options `required` function defined, `isRequired` will be true.
So it is easy to understand.

If this property is always required, you can set `required` to be true directly.

```js
const schema = new Schema({
  name: {
    default: '',
    required: true,
  },
})
```

### validate(key, value, context)

Use `required` `type` `validators` option to validate the given property and its value.

```js
const schema = new Schema({
  age: {
    default: 0,
    // use required to validate
    required: 'age is required',
    // use type to validate
    type: Number,
    message: 'age should must be a number.',
    // use validators to validate
    validators: [
      {
        determine() {
          return this.sex = 'M'
        },
        validate(value) {
          return value < 100
        },
        message: 'age should must less than 100.',
      },
    ],
  },
})

const tom = {
  sex: 'M',
  age: 50,
}
schema.validate('age', tom.age, tom) // return an empty array

const jim = {
  sex: 'M',
  age: 120,
}
schema.validate('age', jim.age, jim) // return an array which contains an error
```

The `validate` method will follow the rules:

- whether is disabled? If disabled, returns empty array;
- whether is required? If required and the value is `null`, `undefined`, `''`(empty string), `NaN`, `[]`(empty array) or `{}`(empty object), returns an array contains an error;
- type checking, if fail push an error into return array (not returns);
- validators checking, push failures as errors into return array and returns the array (which may contains type checking errors).

### parse(json, context)

Parse json data with `create` option.

```js
const schema = new Schema({
  height: {
    default: 0,
    create(data) {
      return data.age * 2
    },
  }
})

const data = schema.parse({
  age: 50
}, null) // { height: 100 }
```
s
### export(data, context)

Create a formulated data with `drop` `map` `flat` options by given data.

```js
const schema = new Shcema({
  some: {
    default: {
      id: '',
      text: '',
    },
    drop() {
      return this.isDrop
    },
    map(value) {
      return value.id
    },
    flat(value) {
      return {
        some_text: value.text,
      }
    }
  },
})

const obj = {
  isDrop: false,
  some: {
    id: '123',
    text: 'some',
  },
}
const data = schema.export(obj, obj)
// => { some: '123', some_text: 'some' }
```

## Recommend

Any way, in fact, we are not recommend to use Schema directly, it is always used with `Model`, I do not think use Schema as a factory will help you, but you should know the usage so that one day when you need you can use.
