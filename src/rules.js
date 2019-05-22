import Type from './type.js'
import { isFunction, isInstanceOf, inObject, isArray, isObject, isEqual } from './utils.js'
import TyError, { makeError } from './error.js'
import Rule from './rule.js'
import Tuple from './types/tuple.js'
import Ty from './ty.js'


/**
 * Verify a rule by using custom error message
 * @param {Rule|Type|Function} pattern
 * @param {String|Function} message
 */
export function validate(pattern, message = 'mistaken') {
  function validate(value) {
    if (isFunction(pattern)) {
      return !!pattern(value)
    }
    else if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      return !pattern.validate(value)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      return pattern.test(value)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      return type.test(value)
    }
  }
  return new Rule({
    name: 'validate',
    message,
    validate,
  })
}

/**
 * asynchronous rule
 * @param {Function} fn which can be an async function and should return a pattern
 */
export function asynchronous(fn) {
  function validate(value) {
    if (this.__await__) {
      let pattern = this.__await__
      let info = { value, pattern, rule: this, level: 'rule', action: 'validate' }

      if (isInstanceOf(pattern, Rule)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.validate(value)
        return makeError(error, info)
      }
      else if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.catch(value)
        return makeError(error, info)
      }
      else {
        let type = Ty.create(pattern)
        if (this.isStrict) {
          type.toBeStrict()
        }
        let error = type.catch(value)
        return makeError(error, info)
      }
    }

    return true
  }
  const rule = new Rule({
    name: 'asynchronous',
    validate,
  })
  Promise.resolve().then(() => fn()).then((pattern) => {
    rule.__await__ = pattern
  })
  return rule
}

/**
 * the passed value should match all passed patterns
 * @param {...Pattern} pattern
 */
export function match(...patterns) {
  function validate(value) {
    const validate = (value, pattern) => {
      let info = { value, pattern, rule: this, level: 'rule', action: 'validate' }

      if (isInstanceOf(pattern, Rule)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.validate(value)
        return makeError(error, info)
      }
      else if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.catch(value)
        return makeError(error, info)
      }
      else {
        let type = Ty.create(pattern)
        if (this.isStrict) {
          type.toBeStrict()
        }
        let error = type.catch(value)
        return makeError(error, info)
      }
    }
    for (let i = 0, len = patterns.length; i < len; i ++) {
      let pattern = patterns[i]
      let error = validate(value, pattern)
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
 * the passed value should not match patterns
 * @param {Pattern} pattern
 */
export function shouldnotmatch(pattern, message = 'mistaken') {
  function validate(value) {
    if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      return !!pattern.validate(value)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      return !pattern.test(value)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      return !type.test(value)
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
  let data = []

  function prepare(value, key, target) {
    isReady = true
    if (inObject(key, target)) {
      isExist = true
    }
    data = [key, target]
  }
  function complete() {
    isReady = false
    isExist = false
    data = []
  }
  function validate(value) {
    if (!isReady) {
      return new TyError('ifexist can not be used in this situation.')
    }
    if (!isExist) {
      return null
    }

    const [key, target] = data
    const info = { value, pattern, rule: this, level: 'rule', action: 'validate' }

    if (target && isArray(target)) {
      info.index = key
    }
    else if (target && isObject(target)) {
      info.key = key
    }

    if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let [key, target] = data
      let error = pattern.validate2(value, key, target)
      return makeError(error, info)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.catch(value)
      return makeError(error, info)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      let error = type.catch(value)
      return makeError(error, info)
    }
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
  function override(value, key, target) {
    target[key] = isFunction(callback) ? callback(value, key, target) : callback
  }
  function validate(value) {
    const info = { value, pattern, rule: this, level: 'rule', action: 'validate' }
    if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.validate(value)
      return makeError(error, info)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.catch(value)
      return makeError(error, info)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      let error = type.catch(value)
      return makeError(error, info)
    }
  }

  return new Rule({
    name: 'ifnotmatch',
    validate,
    override,
  })
}

/**
 * determine which pattern to use.
 * @param {Function} determine a function to receive parent node of current prop, and return a pattern
 */
export function determine(determine) {
  let isReady = false
  let pattern = null
  let data = []

  function prepare(value, key, target) {
    pattern = determine(value, key, target)
    isReady = true
    data = [key, target]
  }
  function complete() {
    isReady = false
    pattern = null
    data = []
  }
  function validate(value) {
    if (!isReady) {
      return new TyError('determine can not be used in this situation.')
    }

    const [key, target] = data
    const info = { value, pattern, rule: this, level: 'rule', action: 'validate' }

    if (target && isArray(target)) {
      info.index = key
    }
    else if (target && isObject(target)) {
      info.key = key
    }

    if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let [key, target] = data
      let error = pattern.validate2(value, key, target)
      return makeError(error, info)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.catch(value)
      return makeError(error, info)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      let error = type.catch(value)
      return makeError(error, info)
    }
  }

  return new Rule({
    name: 'determine',
    validate,
    prepare,
    complete,
  })
}

/**
 * Advance version of ifexist, determine whether a prop can not exist with a determine function,
 * if the prop is existing, use the passed type to check.
 * @param {Function} determine the function to return true or false,
 * if true, it means the prop should must exists and will use the second parameter to check data type,
 * if false, it means the prop can not exist
 * @param {Pattern} pattern when the determine function return true, use this to check data type
 */
export function shouldexist(determine, pattern) {
  let isReady = false
  let shouldExist = true
  let isExist = false
  let data = []

  function validate(value) {
    if (!isReady) {
      return new TyError('shouldexist can not be used in this situation.')
    }

    const [key, target] = data
    const info = { value, pattern, rule: this, level: 'rule', action: 'validate' }

    // can not exist and it does not exist, do nothing
    if (!shouldExist && !isExist) {
      return null
    }

    if (isInstanceOf(pattern, Rule)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let [key, target] = data
      let error = pattern.validate2(value, key, target)
      return makeError(error, info)
    }
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.catch(value)
      return makeError(error, info)
    }
    else {
      let type = Ty.create(pattern)
      if (this.isStrict) {
        type.toBeStrict()
      }
      let error = type.catch(value)
      return makeError(error, info)
    }
  }
  function prepare(value, key, target) {
    shouldExist = determine(value, key, target)
    isReady = true
    isExist = inObject(key, target)
    data = [key, target]
  }
  function complete() {
    shouldExist = true
    isReady = false
    isExist = false
    data = []
  }

  return new Rule({
    name: 'shouldexist',
    validate,
    prepare,
    complete,
  })
}

/**
 * Advance version of ifexist, determine whether a prop can not exist with a determine function,
 * if the prop is existing, use the passed type to check.
 * @param {Function} determine the function to return true or false,
 * if true, it means the prop should must exists and will use the second parameter to check data type,
 * if false, it means the prop can not exist
 * @param {Function} determine when the determine function return true, use this to check data type
 */
export function shouldnotexist(determine) {
  let isReady = false
  let shouldNotExist = false
  let isExist = false

  function validate(value) {
    if (!isReady) {
      return new TyError('shouldnotexist can not be used in this situation.')
    }

    // should not exist and is not existing
    if (shouldNotExist && !isExist) {
      return null
    }

    // can exist and is existing
    if (!shouldNotExist && isExist) {
      return null
    }

    const info = { value, rule: this, level: 'rule', action: 'validate' }
    return new TyError('overflow', info)
  }
  function prepare(value, prop, target) {
    shouldNotExist = determine(value, prop, target)
    isReady = true
    isExist = inObject(prop, target)
  }
  function complete() {
    isReady = false
    shouldNotExist = false
    isExist = false
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
export function implement(Interface) {
  return new Rule({
    name: 'implement',
    message: 'mistaken',
    validate: value => isInstanceOf(value, Interface, true),
  })
}

/**
 * Whether the value is eqaul to the given value
 * @param {Any} value
 */
export function equal(value) {
  return new Rule({
    name: 'equal',
    message: 'mistaken',
    validate: v => isEqual(value, v),
  })
}

/**
 * Wether the value is a function
 * @param {Tuple} InputType
 * @param {Any} OutputType
 */
export function lambda(InputType, OutputType) {
  if (!isInstanceOf(InputType, Tuple)) {
    throw new TyError('lambda InputType should be a Tuple')
  }
  if (!isInstanceOf(OutputType, Type)) {
    OutputType = makeType(OutputType)
  }

  let isReady = false
  function validate(value) {
    if (!isReady) {
      return new TyError('lambda is can not be used in this situation.')
    }

    if (!isFunction(value)) {
      const info = { value, pattern: Function, rule: this, level: 'rule', action: 'validate' }
      return new TyError('mistaken', info)
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
    validate,
    prepare,
    complete,
  })
}
