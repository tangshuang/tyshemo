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
  // optional, calculate value when init and the dependencies change, almost like activate, the difference is that, activate will trigger the fields which depend on current field, accept will not trigger, so you should use activate at first and only use accept when needed.
  accept() {
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

  // optional, used by `fromJSON` and `toJSON` to create or save to property
  // ie. asset='some', tyshemo will read property from data.some, and patch save result as json.some
  // {
  //   asset: 'some',
  //   create: value => value, // value = data.some
  //   save: value => value, // json.some = value
  // }
  asset: string,
  // optional, function, used by `fromJSON`.
  create: (value, key, json) => {
    // `json` is the first parameter of `fromJSON`
    return !!json.on_market ? json.listing : json.pending
  },
  // optional, function, used by `toJSON`.
  // use this to create an object which can be used by fromJSON to recover the model
  save: (value, key, data) => {
    // `data` is a bundle object which is from the model
    // `output` is the final result, you can modify it directly and return nothing in `save`
    return newValue
  },
  // optional, path some new properties to output data
  saveAs: (value, key, data, output) => {
    // notice: the return value should MUST be an object, and will be patched to output object (like `mapAs` do), so that you can export a complext object
    return { 'any_other_key': anyValue }
  }

  // optional, function, whether to not use this property when `toData`
  drop: (value, key, data) => Boolean,
  // optional, submit the key to be another name, for example: { to: 'table_1.field_1' } -> { 'table_1.field_1': value }
  // can use keyPath like 'parent.child'
  to: string,
  // optional, function, to override the property value when `toData`,
  // not work when `drop` is false
  map: (value, key, data) => {
    // `output` is the data to be exported, you can modify it directly
    return newValue
  },
  // optional, function, to assign this result to output data,
  // `drop` has no effect for `mapAs`
  // don't forget to set `drop` to be true if you want to drop original property
  mapAs: (value, key, data, output) => {
    // `output` is the data to be exported, you can modify it directly
    return { 'any_other_key': newValue }
  },

  // optional, function, format this property value when set
  setter: (value, key) => value,
  // optional, function, format this property value when get
  getter: (value, key) => newValue,
  // optional, function, format this field to a text, you can read the text on `model.$views.field.text`
  formatter: (value, key) => text,

  // optional, function or boolean or string,
  // if `readonly` is true, you will not be able to change value by using `set` (however `assign` works)
  readonly: boolean | (value, key) => boolean,
  // optional, function or boolean or string,
  // if `disabled` is true, you will not be able to change value by using `set` (however `assign` works),
  // when you invoke `validate`, the validators will be ignored,
  // when you invoke `export`, the `drop` will be set to be `true` automaticly, `mapAs` will not work too
  disabled: boolean | (value, key) => boolean,
  // optional, function or boolean or string,
  // if `hidden` is true, it means you want to hide the field related ui component
  hidden: boolean | (value, key) => boolean,
  // optional, function to determine wheather the field is available
  // when available is false, disabled (drop), hidden will be forcely set `true`
  // it is like a higher priority toggler of `disabled, drop, hidden`
  available: boolean | (value, key) => boolean,

  // optional, function or boolean or string.
  // `required` will affect validation. If `required` is false, validation will be dropped when the given value is empty. For example, schema.validate('some', null, context) -> true. Only when `required` is true, the validation will thrown out the errors when the given value is empty.
  // `Empty` rule: null|undefined|''|NaN|[]|{}
  // works with Validator.required
  required: boolean | (value, key) => boolean,
  // optional, function to determine the value is empty
  // works with Validator.required
  empty: (value, key) => boolean,
  // optional, function or boolean
  // works with Validator.max when value is numeric
  max: number,
  // optional, function or boolean
  // works with Validator.min when value is numeric
  min: number,
  // optional, function or boolean
  // works with Validator.maxLen when value is string
  maxLen: number,
  // optional, function or boolean
  // works with Validator.minLen when value is string
  minLen: number,
  // optional, function or boolean
  // works with Validator.integer when value is numeric
  integer: number,
  // optional, function or boolean
  // works with Validator.decimal when value is numeric
  decimal: number,

  // when this field's value changed, the `watch` function will be invoke
  watch(e) {},
  // when **other** fields changed, follow function will be triggered
  // current field changing will NOT be triggered (use watch instead)
  // if pass an array, it means you want to follow certain field's changes,
  // if pass a function, it means you want to follow any field's changes, you should use `key` to determine which field is changed
  follow(e, key, keyOfChangedField): void | Array<{ key?, meta?, action: (valueOfChangedField, keyOfChangedField) => void }>,

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
  // optional, return an array which contains Metas or Models to point out which targets will trigger current field's reaction.
  // different from `needs` or `deps`, if some Metas or Models are not in this array, there will be no nofication, the missing ones will be ignored
  // and, you can put Metas or Models of parents chain of current field's host model, for example:
  // parent model has a Meta `A_Meta`, and child field `xx` can trace `A_Meta` as you wanted, howver, this pattern is only allowed in Factory hooks, keep in mind that, dont depend on outside models.
  factors() {
    return [
      A_Meta,
      B_Meta,
    ]
  }

  // optional, when an error occurs caused by this property, what to do with the error
  catch: (error) => {},

  // any other attrs
  // i.e. some: 'real_value' -> model.use('fieldName', view => view.some) -> 'real_value'
  // can be modified on view
  // i.e. mode.use('fieldName', view => view.some = 'new_value')
  [attr]: any,
  // if it is a function, it will be used as a getter whose parameter is the key name and return value will be treated as the real value when called on view
  // i.e. some(key) { return 'real_value' } -> model.use('fieldName', view => view.some) -> 'real_value'
  // can NOT be modified on view
  // i.e. mode.use('fieldName', view => view.some = 'new_value') -> not working
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

## AsyncMeta

```js
import { AsyncMeta } from 'tyshemo'

class MyAsyncMeta extends AsyncMeta {
  static default = 1
  static type = Number

  fetchAsyncAttrs() {
    return Promise.resolve({
      validators: [
        {
          validate: v => v > 10,
          message: 'value should gather 10',
        },
      ],
    })
  }
}
```

Work with Loader:

```js
import { AsyncMeta, Loader } from 'tyshemo'

class MyAsyncMeta extends AsyncMeta {
  static default = 1
  static type = Number

  fetchAsyncAttrs() {
    return Promise.resolve(Loader.parseAttrs({
      // `default, activate, accept` is not supported
      'disabled(v)': '{ v > 10 }',
      'drop(v)': '{ !v }',
    }))
  }
}
```

## SceneMeta

```js
import { SceneMeta } from 'tyshemo'

class MySceneMeta extends SceneMeta {
  static default = 1
  static type = Number

  defineScenes() {
    return {
      Scene1: {
        default: 3,
        required: true,
      },
      Scene2: {
        default: 5,
        asset: 'me',
      },
    }
  }
}
```

### createSceneMeta

Create a SceneMeta instance.

```js
import { createSceneMeta, Model } from 'tyshemo'

const MySceneMeta = createSceneMeta(defaultAttributes, {
  Scene1: Scene1Attributes,
  Scene2: async () => Scene2Attributes,
})
```

### How to use Scene?

The first way is to call `Meta#Scene`.

```js
class SomeModel extends Model {
  static my = MySceneMeta.Scene('Scene1')
}
```

The second way is to call `Meta.Scene`.

```js
class SomeModel extends Model {
  static my = someSceneMetaInstance.Scene('Scene1')
}
```

The third way is to call `Model#Scene`.

```js
class SomeModel extends Model.Scene('Scene1') {
  static my = MySceneMeta
}
```

or

```js
class SomeModel extends Model {
  static my = MySceneMeta
}
const SceneModel = SomeModel.Scene('Scene1')
const some = new SceneModel()
// const some = new (SomeModel.Scene('Scene1'))()
```

### Compose multiple scenes.

Just pass an array of scene names to `Scene` method.

```js
MySceneMeta.Scene(['Scene1', 'Scene2'])
someSceneMeta.Scene(['Scene1', 'Scene2'])
SomeSceneModel.Scene(['Scene1', 'Scene2'])
```

Notice the order of passed names, the after scene atrributes will override previous.

### SceneMeta#Scene

```js
import { SceneMeta } from 'tyshemo'

class MySceneMeta extends SceneMeta {
  defineScenes() {
    return {
      Scene1: Scene1Attributes,
      Scene2: async () => Scene2Attributes,
    }
  }
}

class AnyModel extends Model {
  // MySceneMeta.Scene.Scene2 -> Meta which defined with `Scene2`
  static some = MySceneMeta.Scene('Scene2')
}
```

### Meta.switchScene

```js
import { createSceneMeta, Model } from 'tyshemo'

const MySceneMeta = createSceneMeta(defaultAttributes, {
  Scene1: Scene1Attributes,
  Scene2: async () => Scene2Attributes,
})

// switch a Meta instance to be scene `Scene2`
const MyMeta = MySceneMeta.Scene('Scene2')

class SomeModel extends Model.Scene.Scene1 {
  static my = MyMeta
}

const scene1Model = new SomeModel()
```
## Formatting Control

`drop` `map` `mapAs` `to` `disabled` affect the result of `toData`.

## Value Control

`default` `compute` `activate` `accept` `getter` `setter` affect the field value.

**compute** will make this field's value to be computed value, you will get computed result as the value each time. If you depend the field on any other fields, the other fields' changing will trigger this field's watchers. Computed field will lose computability till the value is changed manually. After you manually change the value (set, fromJSON, patch...), the field will not be a computed field any more.

**activate** will make this field's value change when the depndencies change. It is not computed value, you can change the value manually, however, when one of the dependencies changes this field will be forcely reset by `activate`. So the value you manually set is not stable, it will be changed by dependencies.

**accept** is almost like `activate` but not trigger the fields which depend on current field.

```
computed: value=compute()
activate: value=watch(activate)
accept: value=watch(accept)
```

```
a activate with (b, c) -> d activate with (a) -> c changed -> a and d changed
a accept (b, c) -> d accept (a) -> c changed -> a changed and d NOT
```

## createMeta()

To create a meta, you can use `createMeta`.

```
function createMeta(attrs)
```

In typescript, you can get better typing feedback.

## createMetaRef()

To create several metas, in case you want to referer metas to each other in a group.

```
declare function createMetaRef<T extends Meta[]>(create: (...args: Meta[]) => T): T;
```

- create: function to return metas in an array

Notice: `...args` should must be refered in `create` function.

```js
const [NameMeta, AgeMeta, HeightMeta] = createMetaRef((NameMeta, AgeMeta, HeightMeta) => [
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

In the previous code, we use NameMeta, AgeMeta, HeightMeta in each meta, however, if we use createMeta directly we may get error about referer to variable which is not declared before we use it. As used createMetaRef, we can use Meta before it created.

## AsyncMeta

```js
import { AsyncMeta } from 'tyshemo'

class SomeAsyncMeta extends AsyncMeta {
  async fetchAsyncAttrs() {
    ...
  }
}
```

### createAsyncMeta

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

Notice, `default, activate, accept, init, state, compute, AsyncGetter` should not be overrided, they may work only once inside.

## StateMeta

A meta which is treated as state whose `disabled` is force set to be true (can not be reset to false).

```js
import { StateMeta } from 'tyshemo'

class SomeState extends StateMeta {
  static value = 0
}
```

`StateMeta` is special:

- should use `value` instead of `default`
- attributes `default, drop, to, map, state` are not supported
- can be passed into `@state()`

### createStateMeta

```js
const myState = createStateMeta({
  value: 1, // notice here
  setter: (str) => +str,
})
```

### createSceneStateMeta

```js
import { SceneStateMeta, createSceneStateMeta } from 'tyshemo'

// define a class
class SomeSeneState extends SceneStateMeta {
  static value = 0
  defineScenes() {
    return {
      Scene1: Scene1Attributes,
      Scene2: async () => Scene2Attributes,
    }
  }
}

// create an instance
const SomeSceneState = createSceneStateMeta(
  { value: 0 },
  {
    Scene1: Scene1Attributes,
    Scene2: async () => Scene2Attributes,
  },
)
```
