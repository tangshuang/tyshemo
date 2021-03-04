# Loader

An async loader to load json schema from remote to generate local Model.

```js
import { Loader } from 'tyshemo'

class SomeLoader extends Loader {
  fetchJSON(url) {
    return axios.get(url).(res => res.data)
  }
}

new SomeLoader().load(url).then((SomeModel) => {
  const model = new SomeModel()
  ...
})
```

## JSON Schema

A json schema of a Model should be like:

```json
{
  "schema": {
    "name": {
      "default": "tomy",
      "type": "string",
      "required()": "age > 10" // use () after a key to mean a function attribute
    },
    "age": {
      "default": 10,
      "type": "number"
    }
  },
  "state": {
    "is_adult": false
  },
  "attrs": {
    "is_empty": "false"
  },

  // methods for Model
  "methods": {
    "getWeight()": "age * 5"
  }
}
```

The previous json will generate:

```js
class SomeModel extends Model {
  schema() {
    return {
      "name": {
        "default": "tomy",
        "type": "string",
        required() {
          return this.age > 10
        },
      },
      "age": {
        "default": 10,
        "type": "number"
      }
    }
  }
  state() {
    return {
      "is_adult": false
    }
  }
  attrs() {
    return {
      "is_empty": "false"
    }
  }

  getWeight() {
    return this.age * 5
  }
}
```

To support sub-model, you should use `<..>` to point out the key:

```json
{
  "schema": {
    "<submodel>": {
      // the structure of a json schema for submodel
      "schema": { }
    },
    "<submodels>": [ // be an array
      {
        "schema": { }
      }
    ]
  }
}
```

## hooks

Override the following hooks methods to modify the output:

- meta(key, params, exp)
- validator(key, params, exp)
- method(key, params, exp)
- fetchJSON(url)
- types(): pass into type `Parser`
- defs(): define some unknow keys

## API

**load(url)**

Parse the url target Model in a promise.

**static getModelAsync(url)**

```js
Loader.getModelAsync(url).then((SomeModel) => {
  const some = new SomeModel()
  ...
})
```

## Special Fetch Syntax

You should override `Loader.fetch` method to provide fetch operator.

**await fetch**

`await fetch` only works in `methods` option.

```json
{
  "methods": {
    "fetchBookPrice(id)": "await fetch('...' + id).price"
  }
}
```

Notice, the syntax is `await fetch(...).property`, give `.property` directly after `await fetch(...)`

**:fetch**

This is for `AsyncGetter`, only works for Meta.Attribute and state:

```json
{
  "schema": {
    "book": {
      "default": null,
      "priceRange": "[0,100]:fetch('....').range"
    },
  },
  "state": {
    "someGlobalOptions": "[]:fetch('....')"
  }
}
```