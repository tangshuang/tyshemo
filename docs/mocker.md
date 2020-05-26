# Mocker

> Notice, Mocker is not in tyshemo core package any more, we will provide a pacakge called `tyshemo-protocol`.

To mock data from our type system for testing or demo.

## Usage

```js
import { Mocker } from 'tyshemo-protocol'
const mocker = new Mocker()

const mockdata = mocker.mock(SomeDictType)
```

## Loaders

To generate random values for different types, we use loaders to bind a type and a function which is to generate mock value.

A loader is a tuple which contains two items:

- type: such as `String` `Int` or instance of Type
- fn: function to return a value for this type

```js
const loader = [Promise, () => Promise.resolve(Match.random())]
```

How to use loaders?

**Mocker.defaultLoaders**

```js
Mocker.defaultLoaders.unshift(loader)
```

**intance loaders**

```js
const mocker = new Mocker([
  loader,
])
```

**define(type, fn)**

```js
mocker.define(...loader)
```
