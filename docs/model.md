# Model

A model is a data container which restrict the data's type, structure and change rules.
Model is the most important part of tyshemo, it is widely used in many situations.

## Usage

```js
import { Model, Enum } from 'tyshemo'

class MyModel extends Model {
  static name = {
    default: '',
    type: String,
  }

  static age = {
    default: 0,
    type: Number,
  }

  static sex = {
    default: 'M',
    type: new Enum('M', 'F'),
  }
}
```

As you seen, we create a class extends from Model and define static properties on the class to define each property's schema. Notice that, the basic information is the same with what you learn in [Schema](schema.md).

And model supports another schema option `extra`. For example:

```js
class MyModel extends Model {
  static some = {
    default: '',
    extra: {
      label: 'name',
      placeholder: 'Input Name',
    },
  }
}
```

`extra` option is used to provide other information so that you can find them on `$views`.

It supports sub-model too, for example:

```js
class ParentModel extends Model {
  static child = ChildModel // use ChildModel directly, it will be transformed to a schema definition
}
```

## Instance

A Model is an abstract data pattern, to use the model, we should initialize a Model.

```js
const model = new ParentModel()
```

When you initialize, you can pass default data into it.

```js
const tomy = new BoyModel({
  name: 'tomy',
  age: 10,
})
```

Then `tomy` will has the default fields' values. `tomy.name === 'tomy'`.

Now, let's look into the instance, how to use Model to operate data.

### $views

Model instance provides a `$views` property which contains fields information.
Notice, `$views` only contains fields which defined in schema.

```js
const { $views } = model
const { age } = $views

// Here `age` is called a field view. What's on age? =>
// { value, required, disabled, readonly, hidden, errors, ...extra }
```

Why I provide a `$views` property and give structure like this? Because in most cases, we use a field as a single view drive state.

```html
<label>{{age.label}}</label>
<input v-model="age.value" />
<span v-if="age.required">Required</span>
```

*Notice: Change `value` on a field view will trigger watch callbacks*

**view.errors**

The `errors` property on field view is an array.
The array contains errors which is only from `validators`, not contains those from `requried` and type checking.

**$views.$errors**

`$views.$errros` conbime all view.errors tegother, so that you can easily check whether current model have some fileds which not pass validators.

Please explore `$views` by yourself next.

### Read

To read data on a model instance, you have two ways.

**Properties**

Read properties from model instance directly.

```js
const { name, age } = tomy
```

**get(key)**

Invoke `get` method to read field value.

```js
const name = tomy.get('name')
```

**view.value**

Read value from a field view.

```js
const age = tomy.$views.age.value
```

### Update

To update data on a model instance, you have two ways too.

**Properties**

Set value on properties directly.

```js
tomy.age = 20
```

*Notice: Change model properties will trigger watch callbacks*

**set(key, value)**

```js
tomy.set('age', 20)
```

**update(data)**

```js
tomy.update({
  name: 'tomy',
  age: 30,
})
```

**view.value**

Set value directly to the field view's value.

```js
tomy.$views.age.value = 40
```

### define(key, get)

In some case, you want to append a computed property to model instance, you can use `define` method.

```js
model.define('height', function() {
  return this.age * 2
})
```

### watch/unwatch

It is the core feature of model to implement reactive.

```js
model.watch('age', (e) => console.log(e), true)
```

Its parameters has bee told in `Store` [here](store.md).

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

### Restore

When you want to restore data back to model, you can use `restore` method.

```js
model.restore({
  name: 'tina',
  age: 12,
})
```

**fromJSON**

`restore` method will override the whole model data directly, `fromJSON` method will use `create` option in schema to create data and then use created data for restore.

```js
model.fromJSON({
  name: 'tina',
  age: 12,
})
```

**onParse**

Before restore data created, a hook method `onParse` will be invoked.

```js
class StudentModel extends Model {
  static name = {
    default: '',
  }

  static age = {
    default: 0,
  }

  onParse(data) {
    return {
      ...data,
      age: +data.age, // I want to make sure the age is a number
    }
  }
}
```

`onParse` is invoked before data comes into model, you chan do some transforming here.

### Formulate

After all, you want to get whole data for submit to your backend api, you should invoke one of `toJSON` `toParams` or `toFormData` to generate.

```js
const data = model.toJSON()
```

Data here will be generated with `drop` `map` and `flat` options in schema. Read [here](schema.md) to learn more.

- drop: if drop returns true, it means this field will not in `data`
- map: convert field value to another value
- flat: create new fields in final `data` with current field's value

**onExport**

After generated by schema, a hook mehod `onExport` will be invoked.

```js
class StudentModel extends Model {
  static name = {
    default: '',
  }

  static age = {
    default: 0,
  }

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
model.lock()
```

## Schema

You can create custom schema for a model so that you do not need to define static properties.

```js
class SomeModel extends Model {
  schema() {
    return {
      name: {
        default: '',
        type: String,
      },
      age: {
        default: 0,
        type: Number,
      },
    }
  }
}
```

You should return a pure new object for schema.

## State

When you define a Model, in fact, you are define some Domain Model. However, Domain Model in some cases need to have dependencies with state, and this state may be changed by business code. So we provide a `state` define way.

```js
class SomeModel extends Model {
  static some = {
    default: null,
    required() {
      return !this.isFund // use state to check whether need to be required
    },
  }

  state() {
    return {
      isFund: false,
      isInvested: false,
    }
  }
}

const model = new SomeModel({
  isFund: true,
})

// model.isFund === true
// model.isInvested === false

model.set('isFund', false)
```

The properties of state are not in schema, however they are on model, you can update them. You should not delete them.
`state()` should must return a pure new object, should not be shared from global.
The return state object will be used as default state each time new data stored into model (initialize and restore).ccx

## Save and restore

```js
// send data to server side
const data = model.$data
await send(data)

// restore data from server side
const data = await fetch()
model.restore(data)
// || const model = new SomeModel(data)
```

## TraceModel

What is a traced model? In some cases, you may face the situation that, in a form, you want to edit some fields in a popup-modal, however, in the modal, you can cancel the edited fileds. In this case, you have to create a temp state in the modal, so that you can drop the data when you click the cancel button. But this make the state management uncomfortable, TraceModel is to fix this situation.

```js
import { TraceModel } from 'tyshemo'
```

TraceModel is extened from Model, so it has all the methods of Model. However, it has some special methods to help you create traced state.

### commit(tag)

When you open the modal, you should create a state mirror by using `commit`:

```js
function onClick() {
  model.commit('edit') // don't use '$origin' as key
  modal.open()
}
```

By this, it will create a state mirror which contains the whole information about this tag.

And now, you can enjoy the validation of model in modal.

```js
function onSubmit() {
  const errors = model.validate(['key1', 'key2', 'key3']) // only validate the keys of which I have edit
  if (errors) {
    popup.show(erros)
    return
  }

  modal.close()
}
```

### reset(tag)

After a while, if you want to cancel the change, just invoke `reset` to recover state.

```js
function onCancel() {
  model.reset('edit')
  modal.close()
}
```

Isn't it easy to do like this?

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

Notice, `redo` should always follow `undo`, in which there is no state change. If you have changed state after you do `undo`, the history after your change will be clear, so `redo` will not work.

### clear()

Clear all records.
Notice, commits will not be cleared.

```js
model.clear()
mode.undo() // has no effect
model.reset('edit') // works
```
