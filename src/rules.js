import Type from './type.js'
import { isFunction, isInstanceOf, inObject, isArray, isObject, isEqual } from './utils.js'
import Rule from './rule.js'
import Tuple from './tuple.js'
import Ty from './ty.js'
import TyError from './ty-error.js'

export function catchErrorBy(context, pattern, value, key, data) {
  const info = { value, context }
  if (key) {
    if (isArray(data)) {
      info.index = key
    }
    else if (isObject(data)) {
      info.key = key
    }
  }

  if (isInstanceOf(pattern, Rule)) {
    if (context.isStrict && !pattern.isStrict) {
      pattern = pattern.strict
    }
    const error = pattern.validate(value, key, data)
    return error
  }
  else if (isInstanceOf(pattern, Type)) {
    if (context.isStrict && !pattern.isStrict) {
      pattern = pattern.strict
    }
    const error = pattern.catch(value)
    return error
  }
  else {
    const type = Ty.create(pattern)
    if (context.isStrict) {
      type.toBeStrict()
    }
    const error = type.catch(value)
    return error
  }
}

/**
 * asynchronous rule
 * @param {Function} fn which can be an async function and should return a pattern
 */
export function asynchronous(fn) {
  let pattern = null
  let isReady = false
  function validate(value) {
    if (!isReady) {
      return null
    }
    const error = catchErrorBy(this, pattern, value)
    return error
  }
  const rule = new Rule({
    name: 'asynchronous',
    validate,
  })
  Promise.resolve().then(() => fn()).then((res) => {
    pattern = res
    isReady = true
  })
  return rule
}

/**
 * the passed value should match all passed patterns
 * @param {Array} patterns
 */
export function match(patterns) {
  function validate(value) {
    for (let i = 0, len = patterns.length; i < len; i ++) {
      const pattern = patterns[i]
      const error = catchErrorBy(this, pattern, value)
      if (error) {
        return error
      }
    }
  }
  return new Rule({
    name: 'match',
    validate,
  })
}

/**
 * determine which pattern to use.
 * @param {Function} determine a function to receive parent node of current key, and return a pattern
 */
export function determine(determine) {
  let isReady = false
  let pattern = null
  let target = {}

  function prepare({ value, key, data }) {
    pattern = determine({ value, key, data })
    isReady = true
    target = { key, data }
  }
  function complete() {
    isReady = false
    pattern = null
    target = {}
  }
  function validate(value) {
    if (!isReady) {
      return new Error('determine can not be used in this situation.')
    }

    const { key, data } = target
    const error = catchErrorBy(this, pattern, value, key, data)
    return error
  }

  return new Rule({
    name: 'determine',
    validate,
    prepare,
    complete,
  })
}

/**
 * Verify a rule by using custom error message
 * @param {Rule|Type|Function} pattern
 * @param {String|Function} message
 */
export function shouldmatch(pattern, message) {
  function validate(value) {
    let bool = true
    if (isFunction(pattern)) {
      bool = !!pattern(value)
    }
    else if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      const res = pattern.validate(value)
      bool = (res === true || res === undefined || res === null)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      bool = pattern.test(value)
    }
    else {
      const type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      bool = type.test(value)
    }

    if (message) {
      return bool
    }
    else if (!bool) {
      return new TyError({ type: 'exception', pattern, value })
    }
  }
  return new Rule({
    name: 'shouldmatch',
    message,
    validate,
  })
}

/**
 * the passed value should not match patterns
 * @param {Pattern} pattern
 */
export function shouldnotmatch(pattern, message) {
  function validate(value) {
    let bool = true
    if (isFunction(pattern)) {
      bool = !pattern(value)
    }
    else if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      bool = !!pattern.validate(value)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      bool = !pattern.test(value)
    }
    else {
      const type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      bool = !type.test(value)
    }

    if (message) {
      return bool
    }
    else if (!bool) {
      return new TyError({ type: 'unexcepted', pattern, value })
    }
  }
  return new Rule({
    name: 'shouldnotmatch',
    message,
    validate,
  })
}

/**
 * If the value exists, use rule to validate.
 * If not exists, ignore this rule.
 * @param {Pattern} pattern
 */
export function ifexist(pattern) {
  let isReady = false
  let isExist = false
  let target = {}

  function prepare({ key, data }) {
    isReady = true
    if (inObject(key, data)) {
      isExist = true
    }
    target = { key, data }
  }
  function complete() {
    isReady = false
    isExist = false
    target = []
  }
  function validate(value) {
    if (!isReady) {
      return new Error('ifexist can not be used in this situation.')
    }
    if (!isExist) {
      return null
    }

    const { key, data } = target
    const error = catchErrorBy(this, pattern, value, key, data)
    return error
  }

  return new Rule({
    name: 'ifexist',
    validate,
    prepare,
    complete,
  })
}

/**
 * If the value not match pattern, use defaultValue as value.
 * Notice, this will modify original data, which may cause error, so be careful.
 * @param {Pattern} pattern
 * @param {Function|Any} callback a function to return new value with origin old value
 */
export function ifnotmatch(pattern, callback) {
  function override({ value, key, data }) {
    data[key] = isFunction(callback) ? callback({ value, key, data, pattern }) : callback
  }
  function validate(value) {
    const error = catchErrorBy(this, pattern, value)
    return error
  }

  return new Rule({
    name: 'ifnotmatch',
    validate,
    override,
  })
}

/**
 * Advance version of ifexist, determine whether a key need to exist with a determine function.
 * @param {Function} determine the function to return true or false,
 * if true, it means the key should MUST exist and will use the second parameter to check data type,
 * if false, it means the key can not exist
 * @param {Pattern} pattern when the determine function return true, use this to check data type
 */
export function shouldexist(determine, pattern) {
  let isReady = false
  let shouldExist = true
  let isExist = false
  let target = {}

  function validate(value) {
    if (!isReady) {
      return new Error('shouldexist can not be used in this situation.')
    }

    // can not exist and it does not exist, do nothing
    if (!shouldExist && !isExist) {
      return null
    }

    const { key, data } = target
    const error = catchErrorBy(this, pattern, value, key, data)
    return error
  }
  function prepare({ value, key, data }) {
    shouldExist = determine({ value, key, data })
    isReady = true
    isExist = inObject(key, data)
    target = { key, data }
  }
  function complete() {
    shouldExist = true
    isReady = false
    isExist = false
    target = {}
  }

  return new Rule({
    name: 'shouldexist',
    validate,
    prepare,
    complete,
  })
}

/**
 * Advance version of ifexist, determine whether a key can not exist with a determine function.
 * @param {Function} determine the function to return true or false,
 * if true, it means the key should NOT exists,
 * if false, it means the key can not exist and will use the second parameter to check data type
 * @param {Pattern} pattern when the determine function return true, use this to check data type
 */
export function shouldnotexist(determine, pattern) {
  let isReady = false
  let shouldNotExist = false
  let isExist = false
  let target = {}

  function validate(value) {
    if (!isReady) {
      return new Error('shouldnotexist can not be used in this situation.')
    }

    const { key, data } = target

    if (shouldNotExist && isExist) {
      const error = new TyError({ type: 'overflow', key })
      return error
    }

    if (!shouldNotExist && !isExist) {
      return null
    }


    const error = catchErrorBy(this, pattern, value, key, data)
    return error
  }
  function prepare({ value, key, data }) {
    shouldNotExist = determine({ value, key, data })
    isReady = true
    isExist = inObject(key, data)
    target = { key, data }
  }
  function complete() {
    isReady = false
    shouldNotExist = false
    isExist = false
    target = {}
  }

  return new Rule({
    name: 'shouldnotexist',
    validate,
    prepare,
    complete,
  })
}

/**
 * Whether the value is an instance of given class
 * @param {Constructor} Cons should be a class constructor
 */
export function beof(pattern) {
  return new Rule({
    name: 'beof',
    validate: value => isInstanceOf(value, pattern, true) ? null : new TyError({ type: 'exception', value, pattern, name: 'beof' }),
  })
}

/**
 * Whether the value is eqaul to the given value
 * @param {Any} target
 */
export function equal(pattern) {
  return new Rule({
    name: 'equal',
    validate: value => isEqual(value, pattern) ? null : new TyError({ type: 'exception', value, pattern, name: 'equal' }),
  })
}

/**
 * Wether the value is a function
 * @param {Tuple} InputType
 * @param {Any} OutputType
 */
export function lambda(InputType, OutputType) {
  if (!isInstanceOf(InputType, Tuple)) {
    throw new Error('lambda InputType should be a Tuple')
  }
  if (!isInstanceOf(OutputType, Type)) {
    OutputType = makeType(OutputType)
  }

  let isReady = false
  function validate(value) {
    if (!isReady) {
      return new Error('lambda is can not be used in this situation.')
    }

    if (!isFunction(value)) {
      return new Error('lambda should receive a function.')
    }
  }
  function prepare(value, key, target) {
    const lambda = function(...args) {
      InputType.assert(args)
      let result = value.apply(this, args)
      OutputType.assert(result)
      return result
    }
    target[key] = lambda // Notice, change the original reference
    isReady = true
  }
  function complete() {
    isReady = false
  }

  return new Rule({
    name: 'lambda',
    pattern: [InputType, OutputType],
    validate,
    prepare,
    complete,
  })
}
