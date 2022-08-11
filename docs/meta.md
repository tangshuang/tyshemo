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
  // - computed field can be changed by set a value, after changed, it will lose computing ability and to be a normal value, so dont set a value to the computed fields, or you may use `getter` instead
  // - computed filed will notify watchers when dependencies changed (before setting a value)
  compute() {
    const a = this.a
    const b = this.b
    return a + '' + b
  },

  // optional, calculate value when init and the dependencies change,
  // for example, when the model is initialized, the default value '' will be overrided by `activate`
  // later, 'a' changes and the value will be overrided by `activate`
  // make sure what will happen when you use activate, you can change the value manually, however, the manual value will be changed by `activate` later if dependencies change
  activate() {
    const a = this.a
    const b = this.b
    return a + '' + b
  },

  // optional, when passed, `set` action will return prev value if not pass type checking
  // notice: `default` and result of `compute` should match type,
  // can be rule, i.e. equal(String)
  type: string,
  // optional, string, message to return when type checking fail
  message: '',
  // optional, if true, when the given value does not pass type checking, the value will be replace with default value or previous value
  force: boolean,

  // optional
  validators: [
    // read more about [Validator](validator.md)
    validator,
    ...
  ],

  // optional, function, used by `fromJSON`.
  // `json` is the first parameter of `fromJSON`
  create: (value, key, json) => !!json.on_market ? json.listing : json.pending,
  // optional, function, used by `toJSON`.
  // use this to create an object which can be used by fromJSON to recover the model
  save: (value, key, data) => {
    // notice: the return value should MUST be an object, and will be patched to output object (like `flat` do), so that you can export a complext object
    return { [key]: newValue }
  },
  // optional, used by `fromJSON` and `toJSON` to read or save to property
  // ie. asset='some', tyshemo will read property from data.some, and patch save result as json.some
  // {
  //   asset: 'some',
  //   create: value => value, // value = data.some
  //   save: value => value, // json.some = value
  // }
  // notice, if you want to return custom object in create or save, dont pass asset
  asset: string,

  // optional, function, whether to not use this property when `toData`
  drop: (value, key, data) => Boolean,
  // optional, function, to override the property value when `toData`, not work when `drop` is false
  map: (value, key, data) => newValue,
  // optional, function, to assign this result to output data, don't forget to set `drop` to be true if you want to drop original property
  flat: (value, key, data) => ({ [key]: newValue }),
  // optional, submit the key to be another name, for example: { to: 'table_1.field_1' } -> { 'table_1.field_1': value }
  to: string,

  // optional, function, format this property value when set
  setter: (value) => value,
  // optional, function, format this property value when get
  getter: (value) => newValue,
  // optional, function, format this field to a text, you can read the text on `model.$views.field.text`
  formatter: (value) => text,

  // optional, function or boolean or string,
  // if `readonly` is true, you will not be able to change value by using `set` (however `assign` works)
  readonly: boolean | (value, key) => boolean,
  // optional, function or boolean or string,
  // if `disabled` is true, you will not be able to change value by using `set` (however `assign` works),
  // when you invoke `validate`, the validators will be ignored,
  // when you invoke `export`, the `drop` will be set to be `true` automaticly, `flat` will not work too
  // when disabled, readonly will be forcely set `true`
  disabled: boolean | (value, key) => boolean,
  // optional, function or boolean or string,
  // if `hidden` is true, it means you want to hide the field related ui component
  hidden: boolean | (value, key) => boolean,
  // optional, function or boolean or string.
  // `required` will affect validation. If `required` is false, validation will be dropped when the given value is empty. For example, schema.validate('some', null, context) -> true. Only when `required` is true, the validation will thrown out the errors when the given value is empty.
  // `Empty` rule: null|undefined|''|NaN|[]|{}
  required: boolean | (value, key) => boolean,
  // optional, function to determine the value is empty
  empty: (value, key) => boolean,
  // optional, function to determine wheather the field is forbidden
  // when forbidden, disabled, readonly, hidden will be forcely set `true`
  // it is like a higher priority toggler of `disabled, readonly, hidden`
  nugatory: boolean | (value, key) => boolean,

  // when this field's value changed, the `watch` function will be invoke
  watch({ value }, key) {},
  // when **other** fields changed, follow function will be triggered
  // current field changing will NOT be triggered (use watch instead)
  follow(key:string) {},

  // invoke when the model initailized
  init() {},

  // optional, return an object to be attached to model
  state() {
    return {
      some: 'default value',
    }
  },
  // optional, return an object which has the same structure of a schema defs object whose node should must be Meta
  // if depend on a existing field, the field in deps() will not work
  deps() {
    return {
      field_a: A_Meta, // A_Meta is a Meta which defined before
      field_b: B_Meta, // if there is another field called `field_b` on Model, this will not work
    }
  },
  // optional, return an array which contains Metas or Models to point out that this model needs some Metas or Models,
  // if you did not given them in your model, an error will be thrown out
  // when you know which property name you will use, use `deps` instead
  needs() {
    return [
      A_Meta,
      B_Meta,
    ]
  }

  // optional, when an error occurs caused by this property, what to do with the error
  catch: (error) => {},

  // any other attr name, which can be used in Model by Model.attrs method
  // notice, if it is a function, it will be used as a getter whose parameter is the key name and return value will be treated as the real value when called on view
  // i.e. some(key) { return 'real_value' } -> model.$views.field.some -> 'real_value'
  [attr]: any,
  [attr]: (value, key) => any,
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

2) instance.extend

Use `extend` method of an instance.

```js
const PoodB = new Pood().extend({
  default: 'b',
})
```

3) Meta.extend

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

4) refererece

```js
class PoodC extends Meta {
  static name = Pood.name
  static default = 'c'
  static type = Pood.type
  static message = Pood.message
}
```

In this way, you should redefine all attributes in class PoodC, although this make it more code, however definition is much more clear.

5) property

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

6) extends Meta

As a ES class, you can use `extends` keyword like this:

```js
class Pood extends Meta {
  static name = 'pood'
  static default = ''
  static type = String
  static message = 'pood should must be a string'
}

class PoodE extends Pood {
  static name = 'poode'
}
```

PoodE will have all attributes of Pood with own name equals 'poode'.

And another thing yous hould know, if you extends from a Meta which is extended from another upper Meta, the atrributes will be inherited in chain.

```js
class Pood extends Meta {}
class PoodA extends Pood {}
class PoodB extends PoodA {}
```

`PoodB` will have all atrributes in chain `PoodB`->`PoodA`->`Pood`.

## Formatting Control

`drop` `map` `flat` `to` `disabled` affect the result of `toData`.

## Value Control

`default` `compute` `activate` `getter` `setter` affect the field value.

**compute** will make this field's value to be computed value, you will get computed result as the value each time. If you depend the field on any other fields, the other fields' changing will trigger this field's watchers. Computed field will lose computability till the value is changed manually. After you manually change the value, the field will not be a computed field any more.

**activate** will make this field's value change when the depndencies change. It is not computed value, you can change the value manually, however, when one of the dependencies changes this field will be reset by `activate`. So the value you manually set is not stable, it will be changed by dependencies.

## createMeta()

To create a meta, you can use `createMeta`.

```
function createMeta(attrs)

// use Factory.getMeta to generate
function createMeta(Model, attrs, hooks)
function createMeta(Model[], attrs, hooks)
```

In typescript, you can get better typing feedback.

## createMetaGroup()

To create several metas, in case you want to referer metas to each other in a group.

```
declare function createMetaGroup<T extends Meta[]>(count: number, create: (...args: Meta[]) => T): T;
```

- count: the count of metas in the group
- create: function to return metas in an array

```js
const [NameMeta, AgeMeta, HeightMeta] = createMetaGroup(3, (NameMeta, AgeMeta, HeightMeta) => [
  createMeta({
    default: 'tom',
    total() {
      return this.use(NameMeta).value.length + this.use(AgeMeta).value + this.use(HeightMeta).value
    },
  }),
  createMeta({
    default: 10,
    fit() {
      return this.use(NameMeta).value.length / this.use(HeightMeta).value
    },
  }),
  createMeta({
    default: 80,
  }),
])
```

In the previous code, we use NameMeta, AgeMeta, HeightMeta in each meta, however, if we use createMeta directly we may get error about referer to variable which is not declared before we use it. As used createMetaGroup, we can use Meta before it created.

## cretaeAsyncMeta

```
/**
 * create an async meta, which can be overrided by asyncGetter return value
 * @param attrs
 * @param asyncGetter
 */
declare function createAsyncMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>, asyncGetter: (scope: any) => Obj): Meta<T, I, M, U>
```

Example:

```js
const SomeMeta = createAsyncMeta({
  default: 1,
}, () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        required: true,
        // support some simple DSL
        hidden: '{ a > 10 }',
        'disabled(v)': '{ v < 10 }',
      })
    }, 10)
  })
})
```

Notice, `default, activate, init, state, compute, AsyncGetter` should not be overrided, they may work only once inside.
