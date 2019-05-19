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
})
```

The definition passed into Schema should be structed by *propertyName* and *propertyDefinition*.

``` 
{
  property: {
    default: '', // required
    type: String, // required, notice: `default` and result of `compute` should match type
    required: true, // optional, whether the property can be not existing, set to be `false` if you want it can be ignored

    validators: [ // optional
      {
        determine: (value) => Boolean, // whether to run this validator, return true to run, false to forbid
        validate: (value) => Boolean, // whether to pass the validate, return true to pass, false to not pass and throw error
        message: '', // the message of error which throw when validate not pass
      },
    ],

    // computed property, will compute at each time digest end
    compute: function() {
      const a = this.get('a')
      const b = this.get('b')
      return a + '' + b
    },

    prepare: (value, key, data) => !!data.on_market, // optional, used by `rebuild`, `data` is the parameter of `rebuild`

    drop: (value) => Boolean, // optional, whether to not use this property when invoke `jsondata` and `formdata`
    map: (value) => newValue, // optional, to override the property value when using `jsondata` and `formdata`, not work when `drop` is false

    catch: (error) => {}, // when an error occurs caused by this property, what to do with the error, always by using `ensure`
  },
}
```

**validate**

Validate whether the passed data is fit the schema requriement.

- @param {object} data
- @param {any} context

- @param {string} key
- @param {any} value
- @param {any} context

```js
let error = SomeSchema.validate(data)
let error2 = SomeSchema.validate('key1', 'value1', this)
```

It will return an error if not pass, or will return null.

**ensure**

Create a data by passed data.
The output data will completely fit the schema.

```js
const output = SomeSchema.ensure(data)
```

**rebuild**

Use `prepare` to rebuild data.

```js
const SomeSchema = new Schema({
  name: {
    type: String,
    default: '',
  },
  age: {
    type: Number,
    default: 0,
    prepare(value, key, data) {
      return +value
    },
  },
})
const data = SomeSchema.rebuild({
  name: 'tomy',
  age: '10', // this will be convert to be number 10
})
```

**formulate**

Use `map` and `drop` to formulate data.

```js
const SomeSchema = new Schema({
  name: {
    type: String,
    default: '',
  },
  sex: {
    type: new Enum('M', 'F', null),
    default: null,
  },
  age: {
    type: Number,
    default: 0,
    map(value) {
      return value + ''
    },
    drop(value, key, data) {
      return data.sex !== 'M' && data.sex !== 'F'
    },
  },
})
const data = SomeSchema.rebuild({
  name: 'tomy',
  sex: null,
  age: 10, // this will be dropped in data
})
```

**extend**

Get a new schema by extending current schema.

```js
const NewSchema = SomeSchema.extend({
  isShow: {
    type: Boolean,
    defualt: false,
  },
})
```

**extract**

Get a new schema by extracting some definitions from current schema.

```js
const NewSchema = SomeSchema.extract({
  name: true, // pass true to extract this definition
  age: true,
})
```