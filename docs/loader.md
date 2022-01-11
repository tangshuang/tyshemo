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

## Schema JSON

A json schema of a Model should be like:

```json
{
  "schema": {
    "name": {
      "default": "tomy",
      "type": "string",
      "required()": "{ age > 10 }" // use () after a key to mean a function attribute
    },
    "age": {
      "default": 10,
      "type": "number"
    },
    "height": {
      "default": 0,
      "type": { "a": "number" },
      "amount": "{ age * 12 }", // -> special syntax, use {} to wrap expression, equal: "amount()": "age * 12"
      "count(v)": "{ age / 12 }", // -> special syntax, use {} to wrap expression, equal: "count(v)": "age / 12"
      "isNeeded": "{ ..name.required }" // -> special syntax, use .. to instead of `$views.`, equal: "isNeeded": "$views.name.required"
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
    "getWeight()": "age * 5" // -> functions can ignore {}, not recommanded
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
    ],
    "submodel": { // supplement for submodel, some content as a normal field meta
      // ...
    }
  }
}
```

## hooks

Override the following hooks methods to modify the output:

- meta(meta): meta
- attr(key, params, exp): [key, params, exp]
- validator(key, params, exp): [key, params, exp]
- method(key, params, exp): [key, params, exp]
- types(): pass into type `Parser`
- defs(): define some unknow keys
- global(): global scope
- filters(): filters inside
- extends(Model): Model
- fetch(url): define the fetch function inside, use window.fetch as default

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

`await fetch` help you to create async functions. For example:

```json
{
  "methods": {
    "fetchBookPrice(id)": "{ await fetch('...' + id).price }"
  }
}
```

```
await fetch(url).prop
```

When tyshemo loader saw the word `await fetch`, it will treate this function as an async function. (only works in functions.)

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
    "someGlobalOptions": "$(book):[]:fetch('....')"
  }
}
```

```
default_value:fetch(url).prop
$(dep1,dep2):default_value:fetch(url).prop -> $(...): to give deps
```
