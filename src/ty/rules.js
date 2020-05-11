import {
  isFunction,
  isInstanceOf,
  inObject,
  isArray,
  isObject,
  isEqual,
} from 'ts-fns'

import Type from './type.js'
import Rule from './rule.js'
import Tuple from './tuple.js'
import TyError from './ty-error.js'

import Dict from './dict.js'
import List from './list.js'
import { Any } from './prototypes.js'

export function create(type) {
  if (isInstanceOf(type, Type)) {
    return type
  }
  else if (isInstanceOf(type, Rule)) {
    return type
  }
  else if (isObject(type)) {
    type = new Dict(type)
  }
  else if (isArray(type)) {
    type = new List(type)
  }
  else {
    type = new Type(type)
  }

  return type
}

// function catchErrorBy(context, pattern, value, key, data) {
//   if (isInstanceOf(pattern, Rule)) {
//     if (context.isStrict && !pattern.isStrict) {
//       pattern = pattern.strict
//     }
//     const error = pattern.validate(value, key, data)
//     return error
//   }
//   else if (isInstanceOf(pattern, Type)) {
//     if (context.isStrict && !pattern.isStrict) {
//       pattern = pattern.strict
//     }
//     const error = pattern.catch(value)
//     return error
//   }
//   else {
//     const type = Ty.create(pattern)
//     if (context.isStrict) {
//       type.toBeStrict()
//     }
//     const error = type.catch(value)
//     return error
//   }
// }

/**
 * asynch rule
 * @param {Function} fn which can be an async function and should return a pattern
 */
export function asynch(fn) {
  let pattern = Any

  const rule = new Rule({
    name: 'asynch',
    pattern,
    use: () => pattern,
  })

  Promise.resolve().then(() => fn()).then((res) => {
    pattern = create(res)
    rule.pattern = pattern
  })

  return rule
}

/**
 * the passed value should match all passed patterns
 * @param {Array} patterns
 */
export function match(patterns) {
  const rule = new Rule({
    name: 'match',
    pattern: patterns,
    validate(data, key) {
      for (let i = 0, len = patterns.length; i < len; i ++) {
        const pattern = create(patterns[i])
        const error = this.validate(data, key, pattern)
        if (error) {
          return error
        }
      }
      return true
    },
  })
  return rule
}

/**
 * determine which pattern to use.
 * @param {Function} determine a function to receive parent node of current key, and return a pattern
 */
export function determine(determine, A, B) {
  const rule = new Rule({
    name: 'determine',
    pattern: [A, B],
    use(data) {
      const bool = determine(data)
      const choice = bool ? A : B
      const pattern = create(choice)
      return pattern
    },
  })
  return rule
}

/**
 * Verify a rule by using custom error message
 * @param {Rule|Type|Function} pattern
 * @param {String|Function} message
 */
export function shouldmatch(pattern, message) {
  const type = create(pattern)
  const rule = new Rule({
    name: 'shouldmatch',
    pattern,
    message,
    use: () => type,
  })
  return rule
}

/**
 * the passed value should not match patterns
 * @param {Pattern} pattern
 */
export function shouldnotmatch(pattern, message) {
  const type = create(pattern)
  const rule = new Rule({
    name: 'shouldnotmatch',
    pattern,
    message,
    validate(data, key) {
      const error = this.validate(data, key, type)
      return !error
    },
  })
  return rule
}

/**
 * If the value exists, use rule to validate.
 * If not exists, ignore this rule.
 * @param {Pattern} pattern
 */
export function ifexist(pattern) {
  const type = create(pattern)
  const rule = new Rule({
    name: 'ifexist',
    pattern,
    shouldcheck(data, key) {
      return key in data
    },
    use: () => type,
  })
  return rule
}

/**
 * If the value not match pattern, use callback as value.
 * Notice, this will modify original data, which may cause error, so be careful.
 * @param {Pattern} pattern
 * @param {Function|Any} callback a function to return new value with origin old value
 */
export function ifnotmatch(pattern, callback) {
  const type = create(pattern)
  const rule = new Rule({
    name: 'ifnotmatch',
    pattern,
    use: () => type,
    override(data, key) {
      data[key] = isFunction(callback) ? callback(data, key) : callback
    },
  })
  return rule
}

/**
 * If the value match pattern, use callback as value.
 * @param {*} pattern
 * @param {*} callback
 */
export function ifmatch(pattern, callback) {
  const type = create(pattern)
  let isOverrided = false

  const rule = new Rule({
    name: 'ifnotmatch',
    pattern,
    validate(data, key) {
      if (isOverrided) {
        return null
      }
      const error = this.validate(data, key, type)
      return !error
    },
    override(data, key) {
      data[key] = isFunction(callback) ? callback(data, key) : callback
      isOverrided = true
    },
  })
  return rule
}

/**
 * Advance version of ifexist, determine whether a key need to exist with a determine function.
 * @param {Function} determine the function to return true or false,
 * if true, it means the key should MUST exist and will use the second parameter to check data type,
 * if false:
 *  a) when exist, will use the second parameter to check data type.
 *  b) when not exit, ignore
 * @param {Pattern} pattern when the determine function return true, use this to check data type
 */
export function shouldexist(determine, pattern) {
  const type = create(pattern)
  const rule = new Rule({
    name: 'shouldexist',
    pattern,
    shouldcheck(data, key) {
      const bool = determine(data)
      if (bool) {
        return true
      }
      else {
        return key in data
      }
    },
    use: () => type,
  })
  return rule
}

/**
 * Advance version of ifexist, determine whether a key can not exist with a determine function.
 * @param {Function} determine the function to return true or false,
 * if true, it means the key should NOT exists,
 * if false:
 *  a) when exist, will use the second parameter to check data type.
 *  b) when not exit, ignore
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
  function prepare(value, key, data) {
    shouldNotExist = determine(data)
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

  const rule = new Rule({
    name: 'shouldnotexist',
    validate,
    prepare,
    complete,
    pattern,
  })
  rule.determine = determine
  return rule
}

/**
 * Whether the value is an instance of given class
 * @param {Constructor} Cons should be a class constructor
 */
export function instance(pattern) {
  return new Rule({
    name: 'instance',
    validate: value => isInstanceOf(value, pattern, true) ? null : new TyError({ type: 'exception', value, pattern, name: 'instance' }),
    pattern,
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
    pattern,
  })
}

/**
 * Can be null, or match the passed pattern
 * @param {*} pattern
 */
export function nullable(pattern) {
  return new Rule({
    name: 'nullable',
    validate: function(value) {
      if (value === null) {
        return null
      }
      const error = catchErrorBy(this, pattern, value)
      return error
    },
    pattern,
  })
}

/**
 * Wether the value is a function
 * @param {Tuple} InputType
 * @param {Any} OutputType
 */
export function lambda(InputType, OutputType) {
  if (isArray(InputType)) {
    InputType = new Tuple(InputType)
  }
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
