# TySheMo

A helper for devloper to use TySheMo more simple and quickly.

## Usage

```js
import TySheMo from 'tyshemo'

TySheMo.expect(10).to.be(Number)
let error = TySheMo.catch(10).by(Number)
if (TySheMo.is(10).of(Number)) {
  // ...
}

const ts = new TySheMo()
ts.bind(error => console.log(error))
ts.expect(10).to.be(String)
```

`TySheMo` is a class constructor, and it has some methods to operate quickly.

## API

**expect.to.be/expect.to.match**

```js
ts.expect(10).to.be(Number) // => new Type(Number).assert(10)
ts.expect(10).to.match(Number)
```

**catch.by**

```js
let error = ts.catch(10).by(Number)
if (error) {
  console.log(error)
}
```

**is.typeof/is.of**

```js
ts.is(Number).typeof(10)
ts.is(10).of(Number)
```

**trace.by**

```js
ts.trace(10).by(Number).then(() => {}).catch(error => console.log(error))
```

**track.by**

```js
ts.track(10).by(Number).catch(error => connsole.log(error))
```

**bind/unbind**

When you use `TySheMo` helper to assert value, you can catch error in a seprated mode.
You can collect all error by using `bind`.
You should pass a function into `bind` and receive error with its parameter.

```js
function collectError(error) {
  // ...
}
ts.bind(collectError)
let bool = ts.is(10).of(String) // collectError will be run, because of checking fail
```

`unbind` is to remove `fn` from listeners list.

**silent**

By default, an error occurs when you using `expect` `track` and `trace`, a error will be thrown. However, when you set silent mode, the error will be not thrown, you should use `bind` to collect error by yourself.

```js
ts.bind(fn)
ts.silent(true) // set to be silent mode
```

**decorate.by.with**

```js
const TySheMoInstance = new TySheMo()
TySheMoInstance.silent(false)

class A {
  @decorate().with(Number)
  a = 10

  @decorate('input').by(TySheMoInstance).with(SomeTupleType)
  @decorate('output').by(TySheMoInstance).with(Object)
  calc(x, y) {}
}
```
