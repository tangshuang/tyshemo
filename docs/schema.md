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

To create a schema instance, you should pass an object parameter to define the data structure and inner rules. The definition object contains all needed fields of data.

Each property's name is to be the field's name:

```js
const schema = new Schema({
  key1: {},
  key2: {},
  key3: {},
})
```

And the property value should be an object which contains options which called `meta` in tyshemo. It is now supporting following metas:

```js
const metas = {
  // required, any,
  // if you need to return an object/array, you should give a function to return,
  // i.e. default() { return { name: 'some' } }
  default: '',

  // optional, computed property, will compute at each time digest end
  // when it is a compute property, it is not able to use `set` to update value
  compute() {
    const a = this.a
    const b = this.b
    return a + '' + b
  },

  // optional, when passed, `set` action will return prev value if not pass type checking
  // notice: `default` and result of `compute` should match type,
  // can be rule, i.e. equal(String)
  type: String,
  // optional, string, message to return when type checking fail
  message: '',

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

  // optional, function, whether to not use this property when export
  drop: (value, key, data) => Boolean,
  // optional, function, to override the property value when export, not work when `drop` is false
  map: (value, key, data) => newValue,
  // optional, function, to assign this result to output data, don't forget to set `drop` to be true if you want to drop original property
  flat: (value, key, data) => ({ newProp: newValue }),

  // optional, function, format this property value when get
  getter: (value) => newValue,
  // optional, function, format this property value when set
  setter: (value) => value,

  // optional, function or boolean or string, if `required` is true, when you invoke `validate` and the value is empty, an error will be in the errors list
  required: Boolean,
  // optional, function or boolean or string, if `readonly` is true, you will not be able to change value by using `set` (however `assign` works)
  readonly: Boolean,
  // optional, function or boolean or string, if `disabled` is true, you will not be able to change value by using `set` (however `assign` works), when you invoke `validate`, the validators will be ignored, and when you invoke `export`, the `drop` option will be set to be `true` automaticly
  disabled: Boolean,

  // optional, when an error occurs caused by this property, what to do with the error
  catch: (error) => {},

  // --- the following metas are only and force enabled in Model ---

  // optional, function or boolean, use schema.hidden(field) to check whether the field should be hidden
  hidden: Boolean,

  // when this field's value changed, the `watch` schema option will be invoke
  watch({ value }) {},

  // any other meta name, which can be used in Model by Model.metas method
  [meta]: any
}
```

Here, `defualt` `getter` `disabled` and so on are called `meta`. Each *meta* can be used in Model, read more about [model](model.md).

## Recommend

Notice, you may never use `Schema` alone, you should always use it with `Model`. Read [document of Model](model.md) to learn more.

In fact, we are not recommend to use Schema directly, it is always used with `Model`, I do not think use Schema as a factory will help you, but you should know the usage so that one day when you need you can use.
