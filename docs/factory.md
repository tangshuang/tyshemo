# Factory

A helper factory to generate custom sub model as meta.

```js
import { Model, Factory } from 'tyshemo'

class SomeModel extends Model {
  ...
}

class SomeFactory extends Factory {
  create(fn) {
    return (value, key, data) => {
      const res = fn(value, key, data)
      modify(res)
      return res
    }
  }
}

class AnyModel extends Model {
  static some = SomeFactory.getMeta(SomeModel)
}
```

## hooks

You can override the methods for meta generators by hooks functions, they are:

- entry(Model)
- instance(model)
- default(fn)
- type(type)
- validators(validators)
- create(fn)
- save(fn)
- map(fn)
- setter(fn)

`fn` is a function for original generator.

## API

**getMeta()**

Get the instance's generated meta.

**static useAttrs(Model, attrs)**

Modify some attrs, i.e.

```js
const NewModel = Factory.useAttrs(OriginalModel, [
  [
    'name', // field of OriginalModel
    'required', // attr name of 'name' meta
    (attr, meta) => { // modifier, - attr: the value of attr; - meta: the meta self
      return true
    },
  ],
])
```

**static getMeta(entries)**

Convert a Model or a list of Models to be a meta.

```js
const SomeMeta = Factory.getMeta(SomeModel)
```
