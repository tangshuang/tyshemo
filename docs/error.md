# TyError

When we use tyshemo to check type, we will always receive an Error when checking fails.
The given Error is not native Error instance, it has some special abilities.

## Templates

In tyshemo, there are 7 kinds of Error:

- exception: type not match
- unexcepted: should not match, but matched
- dirty: length greater than given in Tuple
- overflow: in strict, some given properties are not defined in type
- missing: lose properties or Tuple items
- illegal: type of `key` not match in Mapping
- notin: type is not given in Enum

For example:

```js
const SomeType = new Dict({
  name: String,
  age: Number,
})

SomeType.assert({
  name: 'tomy',
  age: '10',
})
```

You will get an Error whose message will be

```
$.age should match `Number`, but receive `"10"`.
```

Pay attention to that, it comes from template:

```
{keyPath} should match `{should}`, but receive `{receive}`.
```

You can change the template by:

```js
import { TyError } from 'tyshemo'

TyError.defaultMessages.exception = '{keyPath}应该是{should}，但接收到{receive}。'
```

After that, when a *exception* Error occurs, the error message will be replaced by new one.

You can change other templates as previous code do.

In template strings, you can use interpolations:

- keyPath
- should
- receive

## Formatting

```js
// prefix of {keyPath}, default is '$.', so you always see `$.a should match...`,
// if you set '', then it will be `a should match...`
TyError.keyPathPrefix = ''
// this make the `should` and `receive` change line when match object or array
TyError.shouldBreakLongMessage = true
// hide real data, string will be replaced with "***", number will be ***
TyError.shouldHideSensitiveData = true
```

## Transform

When you get an Error, you can format it at the time.

```js
const error = SomeType.assert({})
if (error) {
  error.format({
    keyPathPrefix = TyError.keyPathPrefix,
    // TyError will give out all errors of checking, the error list will be joined by this tag
    breaktag = '\n',
    breakline = TyError.shouldBreakLongMessage,
    sensitive = TyError.shouldHideSensitiveData,
    // templates only for this error
    templates = {},
  })
  console.log(error.message)
}
```

After you invoke `format`, the error will be changed, you have no idea to reset.
