# Model

You should extend `Model` class, and override `define` method.

## Usage

```js
import { Model, Enum } from 'tyshemo'

export class CarModel extends Model {
  // you should override the define method, and return the definition of this model
  define() {
    return {
      color: {
        type: new Enum(['black', 'white', 'red']),
        default: 'white',
      },
      year: {
        type: Numeric,
        default: '2006',
      },
    }
  }
}

const car = new CarModel()
console.log(car.year) // 2006
```

The definition is shared with the model's schema.
A propertyDefinition should/could have:

- type {Type}
- default
- compute {Function} if there is `compute` field, it means this property is a computed property, I will show you how to use it later
- validators {Array} works when you use `validate`
  - determine {Function} return true to use this validator, return false to ignore this validator
  - validate {Function} return true to pass the checking, return false to intercept
  - message {Function|String} when intercepted, what to notice back
- prepare {Function} when you use `reset`, how to parse the given data to fill current property value
- flat {Function} when you use `data`, how to patch output data with current property value
- map {Function} when you use `data`, how to convert current property value
- drop {Function|Boolean} when you use `data`, keep this property or not

The propertyDefinition is much more complex then schema's.

## API

A model instance has:

**schema**

The schema of model. It is a property.

```js
const schema = car.schema
const mock = schema.ensure()
```

**get**

Get data by keyPath.

```js
const value = some.get('body.head')
```

**set**

Set data by keyPath

```js
some.set('body.head', 123)
```

Notice: `set` changes data directly, without any warning and type checking.
It is like:

```js
const data = some.data()
data.body.head = 123
```

They are the same.

After you change the data, you should must call `update` to apply computing.

```js
some.set('body.head', 123)
some.set('body.feet', 42)
some.update() // trigger relative chagnes, such as computed properties and watchers
```

**update**

Update model asynchronously, very like react's setState.

```js
const data = some.data()
some.update({
  body: {
    ...data.body,
    feet: 43,
  },
})
```

It will return a promise, you can get the final data in `then`.

```js
some.update(next).then(data => console.log(data))
```

If you pass an empty object or any other value which is not object, it will not update data but just sync computed properties and watchers.

If errors occur, you can catch them in `catch`

```js
some.update(next).catch(error => console.log(error))
```

**watch**

Register a watcher to watch proerty change, very like angular1.x's watch.

```js
some.watch('body', value => console.log(value), true)
```

- keyPath
- fn(currentValue, previousValue)
- deep

**unwatch**

Unregister the watcher which registered by `watch`

- keyPath
- fn

**reset/catch**

When you get data from api, you may want to reset data into model, and use new data. You can use `reset`.

```js
fetch(url).then(res => res.json()).then(data => some.reset(data)).then((data) => {
  console.log(data) // you will get new data here
  some.catch(errors => console.log(errors))
})
```

`catch` is to catch errors which thrown during reseting.
It is asynchronous, the errors are collected during reseting, however you can only get then in catch asynchronously.

**data**

To get data. It receive 4 kind of mode:

- 0: default, get data directly
- 1: get formulated data
- 2: get formulated flat data
- 3: get formulated formdata

```js
const data = some.data()
const formdata = some.data(3)
```

**validate**

Validate current data, return an error if not pass.

```js
let error = some.validate()
if (error) {
  throw error
}
```
