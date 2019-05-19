# Ty

A helper for devloper to use Type more simple and quickly.

## Usage

```js
import { Ty } from 'tyshemo'

Ty.expect(10).to.be(Number)
let error = Ty.catch(10).by(Number)
if (Ty.is(10).of(Number)) {
  // ...
}
```

## API


`Ty` is a class constructor too, and it has some methods.

```js
const ty = new Ty()
ty.bind(error => console.log(error))
ty.expect(10).to.be(String)
```

**expect.to.be/expect.to.match**

Assert.

```js
ty.expect(10).to.be(Number)
ts.expect(10).to.match(Number)
```

**catch.by**

```js
let error = ty.catch(10).by(Number)
if (error) {
  console.log(error)
}
```

**is.typeof/is.of**

```js
ty.is(Number).typeof(10)
ty.is(10).of(Number)
```

**trace.by**

```js
ty.trace(10).by(Number)
	.then(() => {})
	.catch(error => console.log(error))
```

**track.by**

```js
ty.track(10).by(Number)
	then(() => ...)
	.catch(error => connsole.log(error))
```

**bind/unbind**

When you use `Ty` helper to assert value, you can catch error in a seprated mode.
You can collect all error by using `bind`.
You should pass a function into `bind` and receive error with its parameter.

```js
function collectError(error) {
  // ...
}
ty.bind(collectError)
let bool = ty.is(10).of(String) // collectError will be run, because of checking fail
```

`unbind` is to remove `fn` from listeners list.

**silent**

By default, an error occurs when you using `expect` `track` and `trace`, a error will be thrown. However, when you set silent mode, the error will be not thrown, you should use `bind` to collect error by yourself.

```js
ty.bind(fn)
ty.silent(true) // set to be silent mode
```

**decorate.by.with**

```js
const SomeTupleType = new Tuple([Number, Number])
class A {
  @ty.decorate().with(Number)
  a = 10

  @ty.decorate('input').with(SomeTupleType)
  @ty.decorate('output').with(Object)
  calc(x, y) {}
}
```
