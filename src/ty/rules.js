import {
  isFunction,
  isInstanceOf,
  isArray,
  isObject,
  isEqual,
  isNull,
  isNone,
} from 'ts-fns'

import Type from './type.js'
import Rule from './rule.js'
import Tupl from './tuple.js'
import TyError from './ty-error.js'

import Dict from './dict.js'
import List from './list.js'
import { Any } from './prototypes.js'

export function createType(type, strict, loose) {
  let checker = null

  if (isInstanceOf(type, Type)) {
    checker = type.clone()
  }
  else if (isObject(type)) {
    checker = new Dict(type)
  }
  else if (isArray(type)) {
    checker = new List(type)
  }
  else {
    checker = new Type(type)
  }

  if (strict) {
    checker.toBeStrict()
  }

  if (loose) {
    checker.toBeLoose()
  }

  return checker
}

function createRule(type) {
  if (isInstanceOf(type, Rule)) {
    return type
  }
  else {
    return createType(type)
  }
}

/**
 * lazy rule
 * @param {Function} fn which can be an async function and should return a pattern
 */
export function lazy(fn) {
  let pattern = Any

  const rule = new Rule({
    name: 'lazy',
    pattern,
    use: () => pattern,
  })

  const create = (res) => {
    pattern = createRule(res)
    rule.pattern = pattern
  }
  const res = fn()
  if (isInstanceOf(res, Promise)) {
    res.then(create)
  }
  else {
    create(res)
  }

  return rule
}

/**
 * the passed value should match all passed patterns
 * @param {Array} patterns
 */
export function match(...args) {
  if (args.length === 2) {
    return shouldmatch(...args)
  }

  const [patterns] = args
  const rule = new Rule({
    name: 'match',
    pattern: patterns,
    validate(data, key) {
      for (let i = 0, len = patterns.length; i < len; i ++) {
        const pattern = createRule(patterns[i])
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
      const pattern = createRule(choice)
      return pattern
    },
  })
  rule.determine = determine
  return rule
}

/**
 * Verify a rule by using custom error message
 * @param {Rule|Type|Function} pattern
 * @param {String|Function} message
 */
export function shouldmatch(pattern, message) {
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'shouldmatch',
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
 * the passed value should not match patterns
 * @param {Pattern} pattern
 */
export function shouldnotmatch(pattern, message) {
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'shouldnotmatch',
    pattern,
    message,
    validate(data, key) {
      const error = this.validate(data, key, type)
      return !!error
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
  const type = createRule(pattern)
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
  const type = createRule(pattern)
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
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'ifmatch',
    pattern,
    shouldcheck(data, key) {
      return key in data
    },
    use: () => type,
    decorate(data, key) {
      data[key] = isFunction(callback) ? callback(data, key) : callback
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
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'shouldexist',
    pattern,
    message: 'missing',
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
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'shouldnotexist',
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
    validate(data, key) {
      const bool = determine(data)
      if (bool) {
        return new Error('overflow')
      }

      const error = this.validate(data, key, type)
      return error
    },
  })
  return rule
}

/**
 * Whether the value is an instance of given class
 * @param {Constructor} Cons should be a class constructor
 */
export function instance(pattern) {
  const rule = new Rule({
    name: 'instance',
    pattern,
    validate(data, key) {
      const value = data[key]
      return isInstanceOf(value, pattern, true) ? null
        : new TyError({ type: 'exception', value, pattern, name: 'instance' })
    },
  })
  return rule
}

/**
 * Whether the value is eqaul to the given value
 * @param {Any} target
 */
export function equal(pattern) {
  const rule = new Rule({
    name: 'equal',
    pattern,
    validate: (data, key) => {
      const value = data[key]
      return isEqual(value, pattern) ? null
        : new TyError({ type: 'exception', value, pattern, name: 'equal' })
    },
  })
  return rule
}

/**
 * Can be null, or match the passed pattern
 * @param {*} pattern
 */
export function nullable(pattern) {
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'nullable',
    pattern,
    shouldcheck(data, key) {
      return !isNull(data[key])
    },
    use: () => type,
  })
  return rule
}

export function nonable(pattern) {
  const type = createRule(pattern)
  const rule = new Rule({
    name: 'nonable',
    pattern,
    shouldcheck(data, key) {
      return !isNone(data[key])
    },
    use: () => type,
  })
  return rule
}

/**
 * Wether the value is a function
 * @param {Tupl} InputType
 * @param {Any} OutputType
 */
export function lambda(_InputType, _OutputType) {
  const InputType =  isArray(_InputType) ? new Tupl(_InputType) : _InputType
  if (!isInstanceOf(InputType, Tupl)) {
    throw new Error('lambda InputType should be a Tupl')
  }
  const OutputType = !isInstanceOf(_OutputType, Type) ? createType(_OutputType) : _OutputType
  const rule = new Rule({
    name: 'lambda',
    pattern: [InputType, OutputType],
    use: () => Function,
    decorate(data, key) {
      data[key] = function(...args) {
        InputType.assert(args)
        const result = data[key].apply(this, args)
        OutputType.assert(result)
        return result
      }
    },
  })
  return rule
}
