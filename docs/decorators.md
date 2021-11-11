# Decorators

If you do not want to use `Meta` in `Model`, you can use decorators to define like this:

```js
import { Model, meta, state } from 'tyshemo'

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

Use decorators to make your coding more mordern.

> Notice: we are following `@babel/plugin-proposal-decorators@^7.14.5` decorators rules. Welcome to create PR for typescirpt.
