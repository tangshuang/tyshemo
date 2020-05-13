# Store

A mutable state management container, which help you to create reactive object very easily.

## Usage

```js
import { Store } from 'tsyhemo'

const store = new Store({
  a: 1,
  b: 'x',
})
```

A store is a state containers, each store contains one state. You can always change state properties directly like a normal object.

A store instance is a reactive object, which provides a `watch` method to listen changes of properties. With this ability, you can easy do anything when state in store changes. Because of this ability, you will feel that it is like `vue.js`. However, it is more than vue.js if you have only used `vue@2`. We use `Proxy` to implement the reactive system, so you do not need to worry about the operation such as adding a non-existing property, or deleting a property by `delete` operator.

## API

A store is a container, if you want to operate its state, you can use APIs or operate `state` property directly.

### state

`state` property on Store instance is a reactive object for you to use.

```js
const { state } = store
state.a = 2
state.b = 'xx'
delete state.c
```

When you operate `state`, all changes will react to `watch`.

### get(keyPath)

Get a property by given keyPath. A keyPath is a string or array to describe the chain of keys to get the value in deep nested object.

```js
const some = store.get('a.b[1].c')
```

The output value may be a reactive object.

### set(keyPath, value)

Update a property's value by its keyPath.

```js
store.set('a.b[1].c', 'xxx')
```

### del(keyPath)

Delete a property, by its keyPath.

### update(data, async)

Update several properties at once.

```js
store.update({
  name: 'tomy',
  age: 23,
})
```

The second parameters is to make the updating async. And, when it's `true`, multiple times invoking `update` will be merged, this make the update with higher performance.

```js
store.update({ age: 24 }, true)
store.update({ age: 25 }, true)
```

This code update `age` only once, `25` will be used as new value, and only once `watch` will be triggered.

Notice: however, you should know that, the order of updating properties make sense. Why? Because there may be dependencies amoung properties. Make sure you are doing updating in right way.

### watch(keyPath, fn, deep = false)

Register a `watch` callback, so that when the property at the `keyPath` changes, the callback function `fn` will be invoked.

```js
store.watch('some.age', ({ value }) => {
  console.log(value)
})
```

The deep parameter is pointing out that whether this callback function will be invoked when deep nested property changes, for example:

```js
store.watch('some', console.log, true)
store.set('some.name', 'xxx')
```

When we set `deep` to be `true`, and we change some.name, the callback will be invoke. If we set to be `false`, callback will not be invoke.

If you want to watch any changes, set keyPath to be `*`.


```js
store.watch('*', fn, true)
```

Here, if you did not set deep to `true`, only the top level properties' changes can trigger callback.

### unwatch(keyPath, fn)

Remove the `watch` callback from listener list.

## Computed Property

You can use computed property in `Store` very easily.

### how?

```js
const store = new Store({
  name: 'tomy',
  birth: 2009,

  // age is a two-side computed property
  get age() {
    return new Date().getFullYear() - this.birth
  },
  set age(age) {
    this.birth = new Date().getFullYear() - age
  },

  // height is an one-side computed property
  get height() {
    return this.age * 5
  },

  // fatherAge is an one-side computed property, whose value will always be `undefine` and can be set to make `age` property change
  set fatherAge(fage) {
    this.age = fage - 28
  },
})
```

As you seen, it is so easy to define computed property in `Store`. Like vue.js, it has the ability of dependencies collection, so you do not need to worry about cache.

```js
state.age = 20 // state.height === 100
```

Computed property will be cached at each time it is computed. So, you'd better not to use dynamic compute in it. If you have to, use `watch` instead.

```js
store.watch('age', function() {
  this.grade = new Date().getFullYear() - 2010
})
```

Yes, you can use `this` in `watch` callback function.

### define(key, options)

You can use `define` method to add, update a computed property.

```js
store.define('weight', function() {
  return this.age * 2 + this.height / 2
})
```

The second parameter can be a function to be treated as getter, or you can give an object which contains `set` and `get` options.

```js
store.define('weight', {
  get() {
    return this.age * 2 + this.height / 2
  },
  set(v) {
    this.age = v / 2 - 20
    this.height = v /2 + 20
  },
})
```

If you want to update the descriptor, you just need to invoke `define` again to re-define the key.

*Notice, only top level property can be defined as a computed property.*

## Binding

In some cases, you may need to work store with other reactive objects.

## bind(key)(store, key)

When a property is dependent on another store, you can use `bind` method to bind them together.

```js
store.define('key', function() {
  return store2.state.age * 2
})
store.bind('key')(store2, 'age')
```

When we designed to like ()()? Because we can bind a key with serval stores more easy.

```js
store.bind('key')(store2, 'age')(store2, 'height')(store3, 'any')
```

## observe(target, subscribe, unsubscribe)

In some cases, you may want to bind current store with other reactive objects which are not stores, you can use observe to implement.

```js
store.observe(
  v => v instanceof Model,
  v => dispatch => v.watch('*', dispatch, true),
  v => dispatch => v.unwatch('*', dispatch),
)
```

Let's look into its parameters:

- determine(v): when a property is set a new value, will run the seconde parameter
- subscribe(v)(dispatch): do subscription to make reactive work, the `dispatch` function will trigger the store to change
- unsubscribe(v)(dispatch)?: when a new value is set to this property, how to unsubscribe the subscription

The `dispatch` function is the same function. However, you can leave the third peramter empty and return a unsubscribe function in the second perameter.

```js
store.observer(v => v === null, v => dispatch => {
  const unbind = v.bind(dispatch)
  return unbind
})
```

This is used in some system which can only get unsubscribe function by return value.
