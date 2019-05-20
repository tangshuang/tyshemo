# Model

You should extend `Model` class, and override `schema` method.
`schema` method should must return an instance of Schema.

## Usage

```js
import { Model, Enum, Schema } from 'tyshemo'

const CarSchema = new Schema({
  color: {
    type: new Enum(['black', 'white', 'red']),
    default: 'white',
  },
  year: {
    type: Numeric,
    default: '2006',
  },
})

export class CarModel extends Model {
  // you should override the define method, and return the schema of this model
  schema() {
    return CarSchema
}

const car = new CarModel() // car will contain defualt value
console.log(car.year) // 2006
```

## API

A model instance has:

**schema**

The schema of model. It is a property (override by instance).

```js
const schema = car.schema
const mockData = schema.ensure({})
```

**data**

The current data of model. It is a property. 
Notice: this.data will be overwrite some times.

```js
const data = car.data // only current data, car.data will be change, and you should get new data then
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

**update**

Update model asynchronously, very like react's `setState`.

```js
const data = some.data
some.update({
  body: {
    ...data.body,
    feet: 43,
  },
})
```

It will return a promise, you can get the final data in `then`.

```js
some.update(next).then(data => console.log(data)) // the new data of model
```

Notice: `set` and `update` will check data first, if it does not data checking, an error will be thrown.
And after calling `set` or `update`, the computed properties will be recomputed and watchers will run.

**watch**

Register a watcher to watch proerty change, very like angular1.x's watch.

```js
some.watch('body', value => console.log(value), true)
```

- keyPath
- fn(currentValue, previousValue)
- priority

**unwatch**

Unregister the watcher which registered by `watch`

- keyPath
- fn

**restore**

When you get data from api, you may want to reset data into model, and use new data. You can use `restore`.

```js
fetch(url).then(res => res.json()).then(data => some.restore(data)).then((data) => {
  console.log(data) // you will get new data here
})
```

**jsondata**

Get formuldated data.

**plaindata**

Get formulated flat data.

```js
{
  ['body.head']: true,
  ['feet[0]']: true,
}
```

**formdata**

Get formulated formdata.

**validate**

Validate current data, return an error if not pass.

```js
let error = some.validate()
if (error) {
  throw error
}
```
