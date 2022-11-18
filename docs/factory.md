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
  static some = SomeFactory.createMeta(SomeModel)
}
```

## hooks

You can override the methods for meta generators by hooks functions, they are:

- select(Entries, data, parent): ModelClass // choose which Model to use
- instance(ChoosedModel, data, options): Model // how to initailize the Model
- adapt(Entries, data, parent): boolean // determine the given data whether adapt to the give Model, if false, the data will be dropped
- transport(childModel, parentModel) // do only once when child model initialized, you can assign parent's properties value to child inside, so that the child model can inherit some properties value from parent
- linkage(childModel, parentModel) // do each time when parent model changes, you can assign parent's properties value to child inside, so that build up the linkage between parent and child.(never use condition sentence inside linkage function)
- override(childModel, parentModel): [{ meta, attrs }] // override metas' attrs by given an array with `meta` and `attrs` properties
- scenes() // provide scenes, the same usage with `SceneMeta.defineScenes`
- default(fn)
- type(type)
- validators(validators)
- create(fn)
- save(fn)
- map(fn)
- setter(fn)

`fn` is a function for original generator.

```js
const SomeMeta = Factory.createMeta([Model1, Model2], null, {
  select([Model1, Model2], data) {
    if (data.type === 'a') {
      return Model1
    }
    return Model2
  }
  adapt([Model1, Model2], data) {
    if (data.type === 'a') {
      return data instanceof Model1
    }
    return data instanceof Model2
  }
})
```

## API

**static createMeta(entries, attrs?, hooks?)**

Convert a Model or a list of Models to be a meta.

```js
const SomeMeta = Factory.createMeta(SomeModel)
```

**static selectMeta(entries, select, attrs?)**

Generate a meta by choosing from given entries.

```js
const SomeMeta = Factory.selectMeta([AModel, BModel, CModel], ([AModel, BModel, CModel], data, key, parentModel) => {
  if (data.type === 'a') {
    return AModel
  }
  ...
})

class SomeModel extends Model {
  static some = SomeMeta
  // static some = AModel | BModel | CModel
}
```

The `select` function will override `select` hook to help you to choose which Model to use.

To create a meta which refer to an array of given Models, you should give the list in an array, i.e.

```js
const SomeMeta = Factory.selectMeta([[AModel, BModel, CModel]], ([AModel, BModel, CModel], data, key, parentModel) => {
  if (data.type === 'a') {
    return AModel
  }
  ...
})

class SomeModel extends Model {
  static some = SomeMeta
  // static some = [AModel, BModel, CModel]
}
```

Notice here, we pass `[[AModel, BModel, CModel]]`, two level array. However, you receive one level array in `select` function.
