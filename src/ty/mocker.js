import {
  isNaN,
  isArray,
  isFunction,
  isInstanceOf,
  isObject,
  isEqual,
  parse,
  assign,
  makeKeyPath,
  map,
  createRandomString,
  each,
} from 'ts-fns'

import {
  Null,
  Undefined,
  None,
  Any,
  Numeric,
  Int,
  Float,
  Negative,
  Positive,
  Natural,
  Finity,
  Zero,
  String8,
  String16,
  String32,
  String64,
  String128,
} from './prototypes.js'

import { Type } from './type.js'
import { Dict } from './dict.js'
import { List } from './list.js'
import { Tupl } from './tuple.js'
import { Enum } from './enum.js'
import { Range } from './range.js'
import { Mapping } from './mapping.js'
import { SelfRef } from './self-ref.js'

import { Rule } from './rule.js'

export class Mocker {
  constructor(loaders) {
    this.init(loaders)
  }
  init(loaders = []) {
    this.loaders = [...loaders, ...Mocker.defaultLoaders]
  }

  define(...args) {
    if (args.length === 2) {
      this.loaders.unshift(args)
    }
    else if (args.length === 1) {
      this.loaders.unshift(args[0])
    }
    return this
  }

  mock(type) {
    let count = 0

    const asyncs = []
    const makePath = (path, key) => path ? path + '.' + key : key
    const makeEnum = (pattern, path) => {
      const count = pattern.length
      const index = parseInt(Math.random() * 10, 10) % count
      const t = pattern[index]
      return createValue(t, path)
    }
    const makeObj = (pattern, path) => {
      const output = map(pattern, (value, key) => {
        const o = createValue(value, makePath(path, key))
        return o
      })
      each(output, (value, key) => {
        if (value === '__SELF__') {
          delete output[key]
        }
      })
      return output
    }
    const makeArr = (pattern, path) => {
      const output = []
      const length = parseInt(Math.random() * 15, 10)
      for (let i = 0; i < length; i ++) {
        output.push(makeEnum(pattern, makePath(path, i)))
      }
      const res = output.filter(item => item !== '__SELF__')
      return res
    }
    const createValue = (target, path = '') => {
      if (isInstanceOf(target, Type)) {
        if (isInstanceOf(target, SelfRef)) {
          if (count > 10) {
            return '__SELF__'
          }

          target = target.pattern
          count ++
        }

        const { pattern } = target
        if (isInstanceOf(target, Dict) || isInstanceOf(target, Tupl)) {
          return makeObj(pattern, path)
        }
        else if (isInstanceOf(target, List)) {
          return makeArr(pattern, path)
        }
        else if (isInstanceOf(target, Enum)) {
          return makeEnum(pattern, path)
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
            const value = createValue(v, makePath(path, k))
            mapping[key] = value
          }
          return mapping
        }
        else {
          return createValue(pattern, path)
        }
      }
      else if (isInstanceOf(target, Rule)) {
        const { name, pattern, determine } = target
        const rand = () => !!(parseInt(Math.random() * 10, 10) % 2)

        if (name === 'ifexist' || name === 'shouldexist' || name === 'shouldnotexist') {
          if (rand()) {
            return createValue(pattern, path)
          }
          else {
            return
          }
        }
        else if (name === 'equal') {
          return pattern
        }
        else if (name === 'shouldnotmatch') {
          const allowed = [String, Number, Boolean, Date, Promise, Array, Object].filter(item => !isEqual(item, pattern))
          return makeEnum(allowed, path)
        }
        else if (name === 'match') {
          return makeEnum(pattern, path)
        }
        else if (name === 'determine') {
          const chain = path.split('.')
          const key = chain.pop()
          asyncs.push({
            path: chain.join('.'), // need to reback up level
            key,
            determine,
          })
        }
        else {
          return createValue(pattern, path)
        }
      }
      else if (isObject(target)) {
        return makeObj(target, path)
      }
      else if (isArray(target)) {
        return makeArr(target, path)
      }
      else {
        return create.call(this, target, path, this.loaders)
      }
    }

    const output = isArray(type) ? makeEnum(type) : createValue(type)

    if (asyncs.length) {
      asyncs.forEach(({ path, key, determine }) => {
        const data = !path ? output : parse(output, path)
        const type = determine(data)
        const v = createValue(type)
        assign(output, makeKeyPath([path, key]), v)
      })
    }

    return output
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
  [Undefined, function() {}],
  [None, function() {
    return [null][parseInt(Math.random() * 100, 10) % 2]
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
  [Natural, function() {
    return parseInt(createRandom(5) * Number.MAX_SAFE_INTEGER, 10) + 1
  }],
  [Any, function() {
    return this.mock([String, Number, Boolean, Date, Promise, Array, Object])
  }],
  function(target, path, next) {
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

function create(target, path, loaders) {
  if (isArray(target)) {
    const protos = target
    const length = protos.length

    const index = parseInt(Math.random() * 10, 10) % length
    const proto = protos[index]

    return create.call(this, proto, path, loaders)
  }

  for (let i = 0, len = loaders.length; i < len; i ++) {
    const item = loaders[i]
    if (isFunction(item)) {
      let notFound = false
      const next = () => {
        notFound = true
      }
      const output = item.call(this, target, path, next)
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
        return fn.call(this, target, path)
      }
      else if (target === proto) {
        return fn.call(this, target, path)
      }
    }
  }

  return target
}
export default Mocker
