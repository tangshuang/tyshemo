# Rule

Rule is to describe the logic type of a property.

In tyshemo, you should use rule in `Dict` and `Tuple` to control properties' logic type.

## Usage

```js
import { ifexist } from 'tyshemo'

const SomeDict = new Dict({
  // use `ifexist` rule on a dict property
  some: ifexist(String),
})

const SomeTuple = new Tuple([
  Number,
  // use `ifexist` rule on the last items of tuple
  ifexist(String),
])
```

## Internel Rules

We provide internal rules, you can use them by `import` very easy.

### ifexist/ife

```
ifexist(:Rule|Type)
```

When a dict property or tuple item not exists, do not check type, when exists, check type.

```js
const SomeType = new Dict({
  some: ifexist(String), // some can be not existing, however, when exists, should must be a string
})
```

### shouldmatch

```
shouldmatch(:Rule|Type, message:string)
```

```js
const SomeType = new Dict({
  some: shouldmatch(String, '{keyPath} should be a string'),
})
```

Use it to custom your own message.

### shouldnotmatch

```
shouldnotmatch(:Rule|Type, message:string)
```

```js
const SomeType = new Dict({
  some: shouldnotmatch(String, '{keyPath} should not be a string'),
})
```

### match

```
match(:Rule|Type, message:string) => shouldmatch
```

If you pass two parameters, it is an alias of `shouldmatch`.

```js
const SomeType = new Dict({
  some: match(String, 'some shoulid be a string'),
})
```

If you pass an array, it will be a composed function:

```
match([:Rule|Type])
```

Make multiple rules work together.

```js
const SomeType = new Dict({
  some: match([
    shouldmatch(String, '{keyPath} should be a string'),
    shouldmatch(Numeric, '{keyPath} should be numeric'),
  ]),
})
```

Rules in the array with be checked one by one, if one fail, the left rules will not work any more.

### ifnotmatch

```
ifnotmatch(:Rule|Type, value:any|Function)
```

Help you to give a default value.

```js
const SomeType = new Dict({
  some: ifnotmatch(Number, 0), // when `some` property is not a number, type checking will not throw error, and `some` property will be set with `0`
})
```

The second parameter can be a function to compute default value dynamicly.

### ifmatch

```
ifmatch(:Rule|Type, override:any|Function)
```

```js
const SomeType = new Dict({
  some: match([
    ifmatch(String, 0), // when `some` property is a string, it will be set with `0`
    shouldmatch(Number, '{keyPath} should be a number'),
  ])
})
```
### determine

```
determin(condition:Function<(data:object):boolean>, A:Type, B:Type)
```

Get type by conditions.

```js
const getType = (some) => {
  return some.type === 'string'
}
const SomeType = new Dict({
  it: determine(getType, String, Number),
})
```

When condition returns true, use the second parameter as type, or returns false, use the third parameter.

*Notice, the `data` parameter is the whole dict object.*

### lazy/async

```
lazy(async function:Function<:Type>)
```

Fetch type by a Promise.

```js
const fetchType = fetch('/api/types?xxxx').then(res => res.json()).then((data) => {
  if (data.type === 'string') {
    return String
  }
  else {
    return Number
  }
})
const SomeType = new Dict({
  some: lazy(fetchType),
})
```

Before the Promise resolved, `some` property will use `Any` as type.


### shouldexist

shouldexist = determine + ifexist

```
shouldexist(condition:Function<(data:object):boolean>, type:Type)
```

When condition return true, the property should MUST exist, when return false, the property can exist or not.
Either true or false, once the property exists, it should must match the type.

```js
const SomeType = new Dict({
  some: shouldexist((data) => !!data.should, String),
})
```

*Notice, the `data` parameter is the whole dict object.*

### shouldnotexist

```
shouldnotexist(condition:Function<(data:object):boolean>, type:Type)
```

When condition return true, the property should NOT exist, when return false, the property can exist or not.
Either true or false, once the property exists, it should must match the type.

```js
const SomeType = new Dict({
  some: shouldnotexist((data) => !!data.shouldnot, String),
})
```

*Notice, the `data` parameter is the whole dict object.*

### instance

```
instance(:Constructor)
```

The property should be an instance of the type.

```js
const SomeType = new Dict({
  some: instance(String), // `some` should MUST be `new String('xxx')`
})
```

### equal

```
equal(:any)
```

The property should totally equal the passed value or same structure of object.

```js
const SomeType = new Dict({
  some: equal({ ok: true }), // `some` should be object which equals structure `{ ok: true }`
})
```

### nullable/nub

```
nullable(:any)
```

Can be `null`.

```js
const SomeType = dict({
  some: nullable(String), // null or String
})
```

### nonable/nob

```
nonable(:any)
```

Can be `null` or `undefined`.

```js
const SomeType = dict({
  some: nonable(String), // null or undefined or String
})
```

### lambda

```
lambda(:Tuple|array, :Type)
```

The property should be a function with given parameters type and return type.

```js
const SomeTuple = new Tuple([Number, Number])
const SomeType = new Dict({
  do: lambda(SomeTuple, Number),
})
```

The first paramter should be a tuple or an array which will be treated as a tupele definition.
The second paramter is the return type.

## Custom Rule

If you want to create a custom rule by yourself, you can use `Rule` class to initialize one.

```js
import { Rule } from 'tyshemo'

const SomeRule = new Rule({
  name: 'Some',
  message: '{keyPath} should not be 0.',
  validate: (data, key) => data[key] !== 0,
})
```

The option `validate` can return boolean or an Error, when return `false` or an Error, it means checking fail, return an Error to contains message when you did not provide `message`, `message` has higher priority.

To create your own rule function, just use `Rule` to wrapper.

```js
function is(type) {
  const rule = new Rule({
    name: 'is',
    message: '{keyPath} should be a ' + type,
    validate: (data, key) => typeof data[key] === type,
  })
}
```

```js
const SomeType = new Dict({
  age: is('string'),
})
```

Notice here, a `validate` function receive (data, key) not (value). This is because we mainly use rule to check the property logic, not the value.

Except `validate`, it supports options:

- name: string // name of this rule, will be used in error
- pattern: Type|\[Type] // will be used in error
- message: string|function // will be used to replace error message
- shouldcheck(data, key)?: boolean // to determine whether to go to check, if return false, the rule validate will not work
- use(data, key)?: Type // use which Type as property value type
- validate(data, key)?: boolean|Error // check logic
- decorate(data, key)? // modify value when checking pass
- override(data, key)? // modify value when checking does not pass
- complete(data, key, error)? // run after checking, return a new Error to replace original Error

If you pass `override`, `valdiate` will run again to make sure the value fit the type.

To create a rule, it is recommeded to declare a function:

```js
function myrule(pattern) {
  const type = Ty.create(pattern)
  const rule = new Rule({
    name: 'myrule',
    pattern,
    shouldcheck(data, key) {
      return key in data
    },
    use: () => type,
    complete(data, key, error) {
      console.error(data, key, error)
      return null // always pass
    },
  })
  return rule
}
```

Then you can use it like:

```js
const SomeType = new Dict({
  some: myrule(String),
})
```

Now you know how to create your custom rule.
