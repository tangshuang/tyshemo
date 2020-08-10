# Meta

A meta is a property's definition in tyshemo model.

## Usage

```js
import { Meta, Model } from 'tyshemo'

class Name extends Meta {
  static default = ''
  static type = String
  static message = 'name should be a string'
}

class Age extends Meta {
  static default = 0
  static type = Number
  static message = 'age should be a number'
}

class Person extends Model {
  static name = new Name()
  static age = new Age()
}
```

Notice in Model definition, we pass `new Name()` into class Person, however, to make it more easy to use, we can pass the Meta class into it directly:

```js
class Person extends Model {
  static name = Name
  static age = Age
}
```

Tyshemo will initialize Meta automaticly inside.

## Attributes

A property of a Meta is called `attribute` in tyshemo. A Meta is made up with attributes.

What attributes does a Meta support? The following ones are supported inside with tyshemo Model:

```js
const attrs = {
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
      break: true, // whether to stop the validation if this validator did not pass, the left validators will be dropped
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

  /**
   * optional, when you want to parse the field from an another name, you can pass it,
   * i.e. {
   *   one: {
   *     default: null,
   *     from: 'some',
   *   },
   * }
   * when you pass into { some }, after parsing, you will get { one }
   */
  from: 'some',
  /**
   * optional, when you want to export the field to an another name, you can pass it,
   * i.e. {
   *   one: {
   *     default: null,
   *     to: 'some',
   *   },
   * }
   * after export, you will get { some } not { one }
   */
  to: 'some',

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

  // optional, function or boolean, use schema.hidden(field) to check whether the field should be hidden
  hidden: Boolean,

  // when this field's value changed, the `watch` schema option will be invoke
  watch({ value }) {},

  // optional, when an error occurs caused by this property, what to do with the error
  catch: (error) => {},

  // any other attr name, which can be used in Model by Model.attrs method
  [attr]: any,
}
```

## Why?

Why we need to define a Meta interface in tyshemo? Why not use js object directly?

Because we need to reuse a Meta in different situations. For example:

```js
class Pood extends Meta {
  static name = 'pood'
  static default = ''
  static type = String
  static message = 'pood should must be a string'
}

// now I want to use pood in situationA
const PoodA = new Pood({
  default: 'a', // override meta's default attribute
})

// now I want to use pood in situationB
const PoodB = new Pood({
  default: 'b', // override meta's default attribute
})
```

When we want to reuse a Meta but without a little different with its attributes, we need to create a new Meta based on original one by changing several attributes.

There are 4 way to extend from a Meta:

1) instance

```js
const PoodA = new Pood({
  default: 'a', // override meta's default attribute
})
```

2) extend

Use `extend` method of an instance.

```js
const PoodB = new Pood().extend({
  default: 'b',
})
```

Use static `extend` method of a Meta.

```js
const PoodB = Pood.extend({
  default: 'b',
})
```

You will always use `extend` when you need to define a attribute with `this` inside:

```js
class SomeModel extends Model {
  static pooda = Pood.extend({
    default: 'a',
    readonly: true,
  })
  static poodb = Pood.extend(class { // here pass a Class, but in fact, only its static properties used
    static default = 'b'
    static required = function() {
      // here `this` point to SomeModel instance
      return this.pooda
    }
  })
}
```

3) refererece

```js
class PoodC extends Meta {
  static name = Pood.name
  static default = 'c'
  static type = Pood.type
  static message = Pood.message
}
```

In this way, you should redefine all attributes in class PoodC, although this make it more code, however definition is much more clear.

4) property

```js
// notice we do not use `static` keyword
class Pood extends Meta {
  name = 'pood'
  default = ''
  type = String
  message = 'pood should must be a string'
}

class PoodD extends Pood {
  default = 'd'
}
```

This is a smart way. Notice, we do not put a `static` keyword in the code. This makes the Pood meta work as a normal js class object. Although it is not work as what we designed, it works as what we want.
