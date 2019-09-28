
import Type from './type.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import Mapping from './mapping.js'
import Rule from './rule.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity, String8, String16, String32, String64, String128 } from './prototypes.js'
import { isNaN, isArray, isFunction, isInstanceOf, map, isObject, isEqual } from './utils.js'

export class Mocker {
  constructor(loaders) {
    this.init(loaders)
  }
  init(loaders = []) {
    this.loaders = [...loaders, ...Mocker.defaultLoaders]
  }

  define(target, loader) {
    if (arguments.length === 2) {
      this.loaders.unshift([target, loader])
    }
    else if (arguments.length === 1) {
      this.loaders.unshift(target)
    }
    return this
  }

  mock(type) {
    const makeEnum = (pattern) => {
      const count = pattern.length
      const index = parseInt(Math.random() * 10, 10) % count
      const t = pattern[index]
      return createValue(t)
    }
    const makeObj = (pattern) => {
      const output = map(pattern, (value) => {
        const o = createValue(value)
        return o
      })
      return output
    }
    const makeArr = (pattern) => {
      const output = []
      const length = parseInt(Math.random() * 15, 10)
      for (let i = 0; i < length; i ++) {
        output.push(makeEnum(pattern))
      }
      return output
    }
    const createValue = (target) => {
      if (isInstanceOf(target, Type)) {
        const { pattern } = target
        if (isInstanceOf(target, Dict) || isInstanceOf(target, Tuple)) {
          return makeObj(pattern)
        }
        else if (isInstanceOf(target, List)) {
          return makeArr(pattern)
        }
        else if (isInstanceOf(target, Enum)) {
          return makeEnum(pattern)
        }
        else if (isInstanceOf(target, Range)) {
          const { min, max } = pattern
          const tween = (max - min) * Math.random()
          const v = min + tween
          return v
        }
        else if (isInstanceOf(target, Mapping)) {
          const [k, v] = pattern
          const count = parseInt(Math.random() * 10, 10) % count
          const mapping = {}
          for (let i = 0; i < count; i ++) {
            const key = createValue(k)
            const value = createValue(v)
            mapping[key] = value
          }
          return mapping
        }
        else {
          return createValue(pattern)
        }
      }
      else if (isInstanceOf(target, Rule)) {
        const { name, pattern } = target
        const determine = () => !!(parseInt(Math.random() * 10, 10) % 2)

        if (name === 'ifexist' || name === 'shouldexist' || name === 'shouldnotexist') {
          if (determine()) {
            return createValue(pattern)
          }
          else {
            return undefined
          }
        }
        else if (name === 'equal') {
          return pattern
        }
        else if (name === 'shouldnotmatch') {
          const allowed = [String, Number, Boolean, Date, Promise, Array, Object].filter(item => !isEqual(item, pattern))
          return makeEnum(allowed)
        }
        else if (name === 'match') {
          return makeEnum(pattern)
        }
        else {
          return createValue(pattern)
        }
      }
      else if (isObject(target)) {
        return makeObj(target)
      }
      else if (isArray(target)) {
        return makeArr(target)
      }
      else {
        return create.call(this, target, this.loaders)
      }
    }

    return isArray(type) ? makeEnum(type) : createValue(type)
  }
}

Mocker.defaultLoaders = [
  [String, function() {
    const length = parseInt(Math.random() * 200, 10)
    return createRandomString(length)
  }],
  [String8, function() {
    return createRandomString(8)
  }],
  [String16, function() {
    return createRandomString(16)
  }],
  [String32, function() {
    return createRandomString(32)
  }],
  [String64, function() {
    return createRandomString(64)
  }],
  [String128, function() {
    return createRandomString(128)
  }],
  [Number, function() {
    const random = createRandom()
    const maxNum = Number.MAX_SAFE_INTEGER
    return random * maxNum
  }],
  [Boolean, function() {
    return !!(parseInt(Math.random() * 100, 10) % 2)
  }],
  [Null, function() {
    return null
  }],
  [Undefined, function() {
    return undefined
  }],
  [Symbol, function() {
    return Symbol()
  }],
  [Function, function() {
    return v => v
  }],
  [Array, function() {
    const length = parseInt(Math.random() * 15, 10)
    const output = []

    for (let i = 0; i < length; i ++) {
      const o = this.mock([String, Number, Boolean, Date, Promise])
      output.push(o)
    }

    return output
  }],
  [Object, function() {
    const length = parseInt(Math.random() * 15, 10)
    const output = {}

    for (let i = 0; i < length; i ++) {
      const key = createRandomString(6)
      const value = this.mock([String, Number, Boolean, Date, Promise])
      output[key] = value
    }

    return output
  }],
  [Numeric, function() {
    return (createRandom(5) * Number.MAX_SAFE_INTEGER).toString()
  }],
  [Int, function() {
    return parseInt(createRandom(5) * Number.MAX_SAFE_INTEGER, 10)
  }],
  [Float, function() {
    return createRandom(5) * Number.MAX_SAFE_INTEGER * 0.12
  }],
  [Negative, function() {
    return - createRandom(5) * Number.MAX_SAFE_INTEGER
  }],
  [Positive, function() {
    return createRandom(5) * Number.MAX_SAFE_INTEGER
  }],
  [Zero, function() {
    return 0
  }],
  [Any, function() {
    return this.mock([String, Number, Boolean, Date, Promise, Array, Object])
  }],
  function(target, next) {
    if (isNaN(target)) {
      return NaN
    }
    next()
  },
  [Infinity, function() {
    return Infinity
  }],
  [Finity, function() {
    return createRandom(5) * Number.MAX_SAFE_INTEGER
  }],
  [Date, function() {
    return new Date()
  }],
  [Promise, function() {
    return Promise.resolve(this.mock(String))
  }],
]

function createRandom(f = 3) {
  let random = 1
  for (let i = 0; i < f; i ++) {
    random = random * Math.random() * 1/(i * 5 + 1)
  }
  return random
}

function createRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let text = ''
  for (let i = 0; i < length; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return text
}

function create(target, loaders) {
  if (isArray(target)) {
    const protos = target
    const length = protos.length

    const index = parseInt(Math.random() * 10, 10) % length
    const proto = protos[index]

    return create.call(this, proto, loaders)
  }

  for (let i = 0, len = loaders.length; i < len; i ++) {
    const item = loaders[i]
    if (isFunction(item)) {
      let notFound = false
      const next = () => {
        notFound = true
      }
      const output = item.call(this, target, next)
      if (!notFound) {
        return output
      }
    }
    else if (isArray(item)) {
      const [proto, fn] = item
      if (isObject(target) && target['!']) {
        const excludes = target['!']
        if (excludes.includes(proto)) {
          continue
        }
        return fn.call(this, target)
      }
      else if (target === proto) {
        return fn.call(this, target)
      }
    }
  }
}

export default Mocker
