# Decorators

If you do not want to use `Meta` in `Model`, you can use decorators to define like this:

```js
import { Model, meta, state, type, inject } from 'tyshemo'
import { Controller } from 'nautil'

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
  @inject(SomeModel)
  // only works on properties which have no initializer
  model: SomeModel;

  @type(Number)
  num = 1;
}
```

> Notice: we are following `proposal-decorators` **legacy** (stage 1).

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

## @inject()

```js
declare function inject(source: any): PropertyDecorator;
```

Patch any to current class.

```js
class A extends Model {
  @inject(SomeMeta)
  some // -> notice, without value
}

console.log(A.some) // -> SomeMeta
```

## @eject(unbind?: boolean)

```js
declare function eject(): PropertyDecorator;
```

Invalidate properties which have no initializer.

```js
class S {
  @eject()
  some: string;
}

console.log(new S()) // -> without `some` own property
```

This always useful when you use typescript to declare a class property and do not want it to generate a property when using `@babel/plugin-proposal-class-properties` (in which will generate a property assigned `void 0` without initializer following standard proposal).

```ts
import { Model, type ReflectMeta, meta, eject } from 'tyshemo'

class SomeModel extends Model {
  @meta(SomeMeta)
  some: ReflectMeta<typeof SomeMeta>
}

class AnyModel extends SomeModel {
  @eject(true)
  some: never
}
```

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
