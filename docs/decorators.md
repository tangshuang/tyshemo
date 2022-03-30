# Decorators

If you do not want to use `Meta` in `Model`, you can use decorators to define like this:

```js
import { Model, Controller, meta, state, type, enhance } from 'tyshemo'

class SomeModel extends Model {
  @meta({
    default: 1,
    // here you may not need to pass `default`, the initializer value will be used as default value
    type: Number,
  })
  // only works on properties which have no initializer
  field: number;

  @state({
    value: 1,
  })
  // only works on properties which have no initializer
  data: number;
}

class SomeController extends Controller {
  @enhance(SomeModel)
  // only works on properties which have no initializer
  model: SomeModel;

  @type(Number)
  num = 1;
}
```

> Notice: we are following `@babel/plugin-proposal-decorators@^7.14.5` decorators rules and should open `legacy` (stage 1) options.

```js
const babelConfig = {
  presets: [
    '@babel/preset-typescript',
  ],
  plugins: [
    ['@babel/plugin-proposal-decorators', { legacy: true }],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
  ],
}
```

## @meta()

```js
declare function meta(entry: Attrs | (new () => Meta) | ModelClass | ModelClass[], options?: Attrs, methods?: Factory): PropertyDecorator;
```

- entry: the given meta attributes information
- options & methods: passed into Factory.getMeta(Some, options, methods)

## @state()

```js
declare function state(options: { value: any } | { get: () => any, set: (v: any) => void }): PropertyDecorator;
```

- { value }: give normal initalizer value
- { get, set }: give getter and setter, eigther

## @enhance()

```js
declare function enhance(source: any): PropertyDecorator;
```

Patch any to current class.

## @type()

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
