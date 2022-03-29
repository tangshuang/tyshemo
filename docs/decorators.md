# Decorators

If you do not want to use `Meta` in `Model`, you can use decorators to define like this:

```js
import { Model, meta, state, type } from 'tyshemo'

class SomeModel extends Model {
  @meta({
    // here you may not need to pass `default`, the initializer value will be used as default value
    type: Number,
  })
  field = 1

  @state()
  data = 1
}
```

The previous code block is the same as:

```js
import { Model } from 'tyshemo'

class SomeModel extends Model {
  schema() {
    return {
      field: {
        default: 1,
        type: Number,
      }
    }
  }

  state() {
    return {
      data: 1,
    }
  }
}
```

```js
@meta(entry: Meta | MetaOptions | Model | [Model], options: MetaOptions, methods: FactoryMethodsOptions, legacy?: boolean)
```

- entry: the given meta attributes information
- options & methods: passed into Factory.getMeta(Some, options, methods)
- legacy: if true, fit for babel; if false or not pass, fit for typescript


```js
@state(legacy?: boolean)
```

- legacy: if true, fit for babel; if false or not pass, fit for typescript


```js
class Person {
  @type(String)
  name = ''

  @type(Number)
  age = 10
}
```

Read more from [ty](./ty.md) to read more about `@type` which alias to `@Ty.decorate.with()`.

Use decorators to make your coding more mordern.

> Notice: we are following `@babel/plugin-proposal-decorators@^7.14.5` decorators rules and should open `legacy` (stage 1) options. Welcome to create PR for typescirpt.
