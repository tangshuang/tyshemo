# Model

A Model is an abstract data structure description interface which restrict the data's type, shape and change rules.
Model is the most important part of tyshemo, it is widely used in many situations.

## Usage

```js
import { Model, Meta, Enum } from 'tyshemo'

class Name extends Meta {
  static default = ''
  static type = String
}

class Age extends Meta {
  static default = 0
  static type = Number
}

class Sex extends Meta {
  static default = 'M'
  static type = new Enum(['M', 'F'])
}

class PersonModel extends Model {
  static name = new Name()
  static age = new Age()
  static sex = new Sex()
}
```

As you seen, we create several metas which are extended from `Meta` (you can read more from [meta](meta.md)) and a model which is extended from Model.
We use static properties on the class to define each feild's definition by given meta's instance.

As metioned in [schema document](schema.md), you can pass Meta class directly into Model definition.

```js
class PersonModel extends Model {
  static name = Name
  static age = Age
  static sex = Sex
}
```

It supports sub-model too, for example:

```js
class ParentModel extends Model {
  static child = ChildModel // use ChildModel directly, it will be transformed to a meta inside
  static children = [ChildModel] // use as a ChildModel list
}
```

## Schema

You can return an object as Model definition in `schema` method for a model so that you do not need to define static properties and is easy to extend the model.

```js
class SomeModel extends Model {
  schema() {
    return {
      name: Name,
      age: Age,
    }
  }
}

class Age2 extends Age {
  static default = Age.default
  static type = Age.type
  static message = 'age should be a ' + Age.type.name
}

// more easy to extends
class OtherModel extends SomeModel {
  schema() {
    const schema = super.schema()
    // use new Meta to override original definition
    schema.age = Age2

    return schema
  }
}
```

## State

When you define a Model, in fact, you are defining a Domain Model. However, Domain Model in some cases need to have dependencies with state, and this state may be changed by business code. So we provide a `state` define way.

```js
class Some extends Meta {
  static state() {
    return {
      some_name: 'some'
    }
  }

  static default = ''
  static compute() {
    return this.some_name
  }
}
```

`Model` will combine all metas' state together to generate own state.

```js
class One extends Model {
  static some = Some // model will generate `some_name` automaticly
}

const one = new One()
expect(one.some_name).toBe('some')
expect(one.$views.some.state.some_name).toBe('some')
```

The properties of state are not in schema, however they are on model, you can update them and trigger watchers. You should not delete them.
`state()` should must return a pure new object, should not be shared from global.
The return state object will be used as default state each time new data restored into model (`init` and `restore`).

## Instance

A Model is an abstract data pattern, to use the model, we should initialize a Model.

```js
const model = new SomeModel() // this will use `default` attr to create values
```

When you initialize, you can pass default data into it.

```js
const model = new SomeModel({
  name: 'tomy',
  age: 10,
}) // other fileds will use `default` attr to create values
```

Then `model` will has the default fields' values. `tomy.name === 'tomy'`.

Now, let's look into the instance, how to use Model to operate data.

### $views

Model instance provides a `$views` property which contains fields information.
Notice, `$views` only contains fields which defined in schema.

```js
const { $views } = model
const { age } = $views

// Here `age` is called 'field view' (short as 'view'). What's on age? =>
// { value, required, disabled, readonly, hidden, errors, ...attrs }
```

Why I provide a `$views` property and give structure like this? Because in most cases, we use a field as a single view drived by state.

```html
<label>{{age.label}}</label>
<input v-model="age.value" />
<span v-if="age.required">Required</span>
```

**view.value**

*Notice: Change `value` on a field view will trigger watch callbacks*

**view.errors**

The `errors` property on view is an array.
The array contains errors which are from `validators`, not contains those from `requried` and `type` checking.

```js
console.log(model.$views.some.errors) // []
```

**view.data**

Get original data of this field without proxy.

**view.text**

Get formatted text of this field, which formatted by meta.formatter as a string.

**view.state**

Get proxied state of this field if `state()` defined in meta.

**$views.$errors**

`$views.$errros` conbime all `view.errors` together, so that you can easily check whether current model have some fileds which not pass validators.

**view.changed**

For some reason, you may need a state to record changing status. `view.changed` will be true after you change the view's value at the first time.

It is useful in forms:

```html
<label>
  <input v-model="some.value" />
  <span v-if="some.changed && some.errors.length">{{some.errors[0].message}}</span>
</label>
```

In this block code, we show error message only after the value of `some` changed.

**$views.$state**

`$views.$state` conbime all states which are defined in `state()` method.

```js
class Some extends Model {
  schema() {
    return {
      name: { default: 'some' },
    }
  }
  state() {
    return {
      isFund: true,
      isPaid: false,
    }
  }
}
```

In this code block, `$views.$state` will be `{ isFund, isPaid }`.

### Read

To read data on a model instance, you have 3 ways.

**Field**

Read fields from model instance directly.

```js
const { name, age } = model
```

**get(key)**

Invoke `get` method to read field value.

```js
const name = model.get('name')
```

**view.value**

Read value from a field view.

```js
const age = model.$views.age.value
```

### Update

To update data on a model instance, you have 4 ways too.

**Field**

Set feild value on model directly.

```js
model.age = 20
```

*Notice: Change model properties will trigger watch callbacks*

**set(key, value, force)**

```js
model.set('age', 20)
```

*force* -> when it is set to be true, `set` will ignore `readonly` and `disabled`.

**update(data)**

```js
model.update({
  name: 'tomy',
  age: 30,
})
```

**view.value**

Set value directly to the field view's value.

```js
model.$views.age.value = 40
```

### watch/unwatch

It is the core feature of model to implement reactive.

```js
model.watch('age', (e) => console.log(e), true)
```

Its parameters has bee told in `Store` [here](store.md).

In schema, it supports `watch` attr, which will listen the field's change, and invoke the function.

```js
class MyModel extends Model {
  static some = {
    default: '',
    // when `some` field's value changes, the function will be invoked
    watch({ value }) {
      console.log(value)
    },
  }
}
```

### validate()

```js
const errors = model.validate()
```

The errors contains all validate checking failure errors (contains required checking and type checking and validators checking).

```js
const errors = model.validate(key)
```

This code validate only one field in model.

```js
const errors = model.validate([key1, key2])
```

This code validate only given fields in model.

**onCheck()**

Before alll validators run, the hook method `onCheck` will be invoked.

```js
class Some extends Model {
  onCheck() {
    const errors = [
      { message: 'xxx' },
    ]
    return errors
  }
}
```

**validateAsync()**

When you define a [validator](valiator.md), you can set a `async` option. `async` option make it an async validator which only works when invoke `valdateAsync`. Async validators support async functions for `determine` `validate` options.

```js
const validator = new Validator({
  async determine() {},
  async validate() {},
  async message() {},
  break: true,
  async: true,
})
```

And when you invoke `validateAsync` method to validate, normal unasync validators will work too.

```js
model.validateAsync().then((errors) => {
  // ...s
})
```

*However, notice that, `model.$views.view.errors` only contains sync validator checking results.*

### Restore

When you want to restore data back to model, you can use `restore` method.

```js
model.restore({
  name: 'tina',
  age: 12,
})
```

*Notice: `restore` will not trigger watchers.*

**onSwitch**

Before restore, a hook method `onSwitch` will be invoked.

```js
class SomeModel extends Model {
  static name = new Meta({
    default: '',
    type: String,
  })

  onSwitch(params) {
    if (!params.name) {
      params.name = 'tomy'
    }
  }
}

const model = new SomeModel()
// model.name === 'tomy'
```

So that each time we create a model instance or invoke `restore` method, name will be use default 'tomy'.

**fromJSON**

`restore` method will override the whole model data directly, `fromJSON` method will use `create` attr in schema to create data and then use created data for restore.

```js
model.fromJSON({
  name: 'tina',
  age: 12,
})
```

**onParse**

Before `fromJSON`, a hook method `onParse` will be invoked.

```js
class StudentModel extends Model {
  static name = new Meta({
    default: '',
  })

  static age = new Meta({
    default: 0,
  })

  onParse(data) {
    return {
      ...data,
      age: +data.age, // I want to make sure the age is a number
    }
  }
}
```

`onParse` is invoked before data comes into model, you chan do some transforming here.

### Export

After all, you want to get whole data for submit to your backend api, you should invoke one of `toJSON` `toParams` or `toFormData` to generate.

```js
const data = model.toJSON()
```

Data here will be generated with `drop` `map` and `flat` attrs in schema. Read [here](schema.md) to learn more.

- drop: if drop returns true, it means this field will not in `data`
- map: convert field value to another value
- flat: create new fields in final `data` with current field's value

**onExport**

After generated by schema, a hook mehod `onExport` will be invoked.

```js
class StudentModel extends Model {
  static name = new Meta({
    default: '',
  })

  static age = new Meta({
    default: 0,
  })

  onExport(data) {
    return {
      ...data,
      length: data.name.length, // patch a undeinfed field before submit to api
    }
  }
}
```

### Lock

In some cases, you want to lock the model, so that any editing will have no effects.

```js
model.lock()
```

Then, updating and restoring will not work.

To unlock:

```js
model.unlock()
```

## Editor

In some cases, you may want to edit data on model without change original model. Tyshemo provides a `toEdit` method on Model for this case.

```js
const some = new SomeModel({
  name: 'aaa',
})
const editor = some.toEdit()

editor.name = 'bbb' // change properties of editor, original `some` properties will not change
expect(some.name).toBe('aaa')

editor.submit() // submit changes back to some
editor.clear()
expect(some.name).toBe('bbb')
```

A `editor` which generated by `toEdit` method is a clone of original model instance. When you change properties of editor, there is no affect on original model (based on correct `save` attribute).

It keeps all changes inside, so after you do not need it, you should invoke `clear()` to free memory. When you invoke `submit()`, the changes will be applied back to original model instance.

### commit(tag)

Create a mirror:

```js
function onClick() {
  model.commit('edit') // don't use '$origin' as key
}
```

By this, it will create a mirror which contains the information about this tag.

### reset(tag)

After a while, if you want to cancel the change, just invoke `reset` to recover.

```js
function onCancel() {
  model.reset('edit')
}
```

Isn't it easy?

### undo()

Cancel the previous change.

```js
model.name = 'tomy'
model.undo()
```

### redo()

Cancel the previous undo.

```js
model.name = 'tomy'
model.undo()

///...
model.redo()
```

Notice, `redo` should always follow `undo`, in which there is a change. If you have changed after you do `undo`, the history after your change will be clear, so `redo` will not work.

### clear()

Clear all history logs (records).
Notice, commits will not be cleared.

```js
model.clear()
mode.undo() // has no effect
model.reset('edit') // works
```

### submit()

Commit changes back to original model.

```js
editor.submit()
some.name === 'changed name'
```

After you submit, the changes will be put into original model.

## Static Editor

The previous part tell about an editor from a model instance. This part give you a Model which contains all features combining normal Model and Editor.

```js
class Some extends Model {}

const editor = new Some.toEdit()
```

Here `editor` has all methods of `Editor` you have learn in the previous part.
The only difference is that, submit should recive a instance of Some.

```js
const some = new Some()
editor.submit(some)
```

## AsyncSetter

```
import { AsyncSetter } from 'tyshemo'

AsyncSetter(defaultValue:Any, asyncSetter:Function)
```

In some cases, you need to fetch data from backend async to change some property, `AsyncSetter` helps you to implement.

```js
import { Meta, AsyncSetter } from 'tyshemo'

class BookPrice extends Meta {
  static default = 0
  static range = AsyncSetter([0, 100], function(key) {
    const bookId = this.id // this point to model
    return fetch('/books/' + bookId).then(res => res.json()).then((data) => {
      const { range } = data
      return range // range will be used finally
    })
  })
}
```

```js
model.watch('!', function(key, attr, newRange) {
  if (key === this.reflect(BookPrice) && attr === 'range') {
    // model.$views.price.range has been set to be newRange, you can do something here, i.e. rerender ui
  }
})
```

The tag `!` for watch is a special operator, when `AsyncSetter` trigger meta.attribute changing, the callback function will be invoked.

`AsyncSetter` can be used on `state` too.

```js
import { Model, AsyncSetter } from 'tyshemo'

class SomeModel extends Model {
  state() {
    return {
      some: AsyncSetter('', () => fetch('...').then(res => res.text())),
    }
  }
}
```

However, `AsyncSetter` for state will not trigger `!`, because you can watch state changing directly.

```js
model.watch('some', ...)
```
