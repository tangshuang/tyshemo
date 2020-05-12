# Ty

`Ty` is a convenient api to use tyshemo's type system.

## Methods

You can use methods of `Ty` directly.

### expect(value).to.be(Type)

Check `value` by `Type`.

```js
Ty.expect(19).to.be(Number)
```

`to.be` equals to `to.match`.

```js
Ty.expect({
  name: 'tomy',
  age: 10,
})
// here you do not need to new a Dict, just pass {} pattern into `match`
.to.match({
  name: String,
  age: Number,
})
```

It is like `assert` which will throw an Error to break process when check fail.

### catch(value).by(Type): Error|null

Get Error of type checking.

```js
const error = Ty.catch(10).by(Number)
```

### track(value).by(Type): Promise

Track value by given type.

```js
Ty.track(10).by(Number).then(() => {
  console.log('no error')
}).catch((e) => {
  console.error(e)
})
```

### trace(value).by(Type): Promise

Trace value by given type.

```js
Ty.trace(10).by(Number).then(() => {
  console.log('no error')
}).catch((e) => {
  console.error(e)
})
```

### is(Type).typeof(value): Boolean

```js
if (Ty.is(Number).typeof(10)) {
  console.log('yes')
}
```

### is(value).of(Type): Boolean

```js
if (Ty.is(10).of(Number)) {
  console.log('yes')
}
```

### @decorate('input'|'output'?).with(Type)

This is a higher usage, which require your build tool supports *decorate*.

```js
@Ty.decorate().with(SomeDict) // decorate constructor
class Some {
  constructor(some) {
    this.data = some
  }

  @Ty.decorate().with(String) // decorate property
  name = ''

  @Ty.decorate().with(Function) // decorate property
  @Ty.decorate('input').with(SongTupleType) // decorate parameters of function
  @Ty.decorate('output').with(SingType) // decorate return of function
  sing(song) {
    // ...
  }
}
```

### create(pattern): Type

```js
// get a Dict
const type = Ty.create({
  name: String,
  age: Number,
})
```

## Instance

`Ty` is also a constructor.

```js
const ty = new Ty()
```

The instance will have all previous methods.

### bind(fn)

To bind a callback to `Ty` instance, so that when an error occurs, the callback function will run.

```js
const watch = error => record(error)
ty.bind(watch)
```

### unbind(fn)

Unbind the bound callback function.

### silent(true|false)

When set `true`, the instance will not throw Error. This affects on `expect.to.be`, `track.by`, `trace.by`.
