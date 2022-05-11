import {
  isInstanceOf,
  isArray,
  isObject,
  isString,
  isEqual,
  isInheritedOf,
  each,
  decideby,
  isUndefined,
  isNull,
  isNone,
  map,
  isNumeric,
  createSafeExp,
  isNaN,
} from 'ts-fns'

import { Ty } from './ty.js'

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
import { Tupl, tuple } from './tuple.js'
import { Enum, enumerate } from './enum.js'
import { Range } from './range.js'
import { Mapping } from './mapping.js'
import { SelfRef } from './self-ref.js'

import { Rule } from './rule.js'
import {
  ifexist,
  match,
  shouldnotmatch,
  equal,
  nonable,
} from './rules.js'

const RULES = {
  '&': nonable,
  '?': ifexist,
  '=': equal,
  '!': shouldnotmatch,
}

export class Parser {
  constructor(types) {
    this.init(types)
  }

  init(types = {}) {
    this.types = { ...Parser.defaultTypes, ...types }
  }

  define(text, target) {
    this.types[text] = target
    return this
  }

  /**
   * description -> type
   * @param {*} description should must be an object
   * {
   *   __def__: [
   *     {
   *       name: 'book',
   *       def: { name: 'string', price: 'float' },
   *     },
   *   ],
   *   name: 'string',
   *   age: 'number',
   *   has_football: '?boolean', // ifexist
   *   sex: 'F|M', // enum
   *   dot: '=xxxxx', // equal
   *   '#belong': 'comments of `belong`',
   *   belong: '?=animal', // ifexist equal
   *   vioce: '!number', // should not match
   *   num: 'string,numeric', // match multiple
   *   '#parents': [
   *     'first line comment',
   *     'second line comment',
   *   ],
   *   parents: '[string,string]', // tuple
   *   books: 'book[]', // list, use defined 'book', recommended
   *   books2: ['book'], // list
   *   '#books3[0]': 'comment of first child of books3',
   *   books3: ['book1', 'book2'], // = 'book1[]|book2[]'
   *   '#body.neck': 'comment for body.neck',
   *   body: {
   *     head: 'boolean',
   *     '#neck': 'comment of neck',
   *     neck: 'boolean',
   *   },
   * }
   */
  parse(description) {
    let types = this.types

    const parse = (text) => {
      const exp = []

      const checkRule = () => {
        const firstChar = text.charAt(0)
        if (RULES[firstChar]) {
          exp.push(RULES[firstChar])
          text = text.substr(1)
          checkRule()
        }
      }
      checkRule()

      // prepare for '(a,b)' and '[a|b]'
      text = text.replace(/\[.*\]/g, (item) => {
        return item.replace(/\|/g, ':@:')
      })
      text = text.replace(/\(.*\)/g, (item) => {
        return item.replace(/,/g, ':@:')
      })

      const items = text.split(',').map((word) => {
        const words = word.split('|').map((item) => {
          // tuple (a,b)
          if (item.charAt(0) === '(' && item.substr(-1) === ')') {
            item = item.substr(1, item.length - 2)
            const texts = item.split(':@:')
            const prototypes = texts.map(item => parse(item))
            return new Tupl(prototypes)
          }
          // list [a|b]
          else if (item.charAt(0) === '[' && item.substr(-1) === ']') {
            item = item.substr(1, item.length - 2)
            // empty list []
            if (!item) {
              return Array
            }
            const texts = item.split(':@:')
            const prototypes = texts.map(item => parse(item))
            return new List(prototypes)
          }
          // list a[]
          else if (item.substr(-2) === '[]') {
            item = item.substr(0, item.length - 2)
            const type = types[item] || item
            return type ? new List([type]) : Array
          }
          // range 10<-20
          else if (/^\-?\d+<?\->?\-?\d+$/.test(item)) {
            const [_, minStr, maxStr] = item.match(/^(\-?\d+)<?\->?(\-?\d+)$/)
            const min = +minStr
            const max = +maxStr
            const minBound = item.indexOf('<-') > 0
            const maxBound = item.indexOf('->') > 0
            return new Range({ min, max, minBound, maxBound })
          }
          // mapping {string:array}
          else if (/^\{\w+?:\w+?\}$/.test(item)) {
            const [k, v] = item.split(/\{\:\}/).filter(item => !!item)
            const kp = types[k] || k
            const vp = types[v] || v
            const t = new Mapping([kp, vp])
            return t
          }
          // other
          else if (types[item]) {
            return types[item]
          }
          // normal
          else {
            try {
              return JSON.parse(item)
            }
            catch (e) {
              return item
            }
          }
        })
        return words.length > 1 ? new Enum(words) : words[0]
      })
      const type = items.length > 1 ? match(items) : items[0]

      exp.reverse()

      let pattern = type
      exp.forEach((rule) => {
        pattern = rule(pattern)
      })

      return pattern
    }

    const target = isObject(description) ? { ...description } : isArray(description) ? [...description] : description

    let parser = this
    let __def__

    if (isObject(target)) {
      __def__ = target.__def__
      delete target.__def__
    }

    if (__def__) {
      __def__.forEach(({ name, def, origin }) => {
        const hasSelf = (target) => {
          if (isObject(target)) {
            const keys = Object.keys(target)
            for (let i = 0, len = keys.length; i < len; i ++) {
              const key = keys[i]
              const value = target[key]
              if (hasSelf(value)) {
                return true
              }
            }
            return false
          }
          else if (isArray(target)) {
            for (let i = 0, len = target.length; i < len; i ++) {
              const value = target[i]
              if (hasSelf(value)) {
                return true
              }
            }
            return false
          }
          else if (isString(target)) {
            return target.indexOf('__self__') > -1
          }
          else {
            return false
          }
        }

        let type = null

        if (origin) {
          type = def
        }
        else if (hasSelf(def)) {
          type = new SelfRef((type) => {
            const parser = new Parser({ ...this.types, __self__: type })
            const t = parser.parse(def)
            return t
          })
        }
        else {
          type = parser.parse(def)
        }

        types = { ...types, [name]: type }
        parser = new Parser(types)
      })
    }

    const comments = {}
    const build = (value, key) => {
      if (key && key.indexOf('#') === 0) {
        comments[key.substr(1)] = value
      }
      else if (isObject(value)) {
        const subtype = parser.parse(value)
        const subcomments = subtype.__comments__
        if (key && subcomments) {
          each(subcomments, (m, k) => {
            comments[key + '.' + k] = m
          })
        }
        return subtype
      }
      else if (isArray(value)) {
        return new List(value.map((item, i) => {
          const subtype = build(item)
          if (typeof subtype !== 'object') {
            return subtype
          }
          const subcomments = subtype.__comments__
          if (key && subcomments) {
            each(subcomments, (m, k) => {
              comments[key + '[' + i + ']' + '.' + k] = m
            })
          }
          return subtype
        }))
      }
      else if (isString(value)) {
        return parse(value)
      }
      else {
        return value
      }
    }

    const pattern = decideby(() => {
      if (isObject(target)) {
        const res = {}

        const customRules = {
          ...RULES,
          '|': enumerate,
          '*': tuple,
        }

        each(target, (value, key) => {
          if (key.indexOf('#') === 0) {
            comments[key.substr(1)] = value
            return
          }

          const chars = key.split('')
          const use = []

          for (let i = chars.length - 1; i > 0; i --) {
            const char = chars[i]
            if (!customRules[char]) {
              break
            }

            use.push(chars.pop())
          }

          const prop = chars.join('')

          const type = decideby(() => {
            // deal with |,: type should be an array
            if (use.indexOf('|') > -1 || use.indexOf('*') > -1) {
              if (!isArray(value)) {
                throw new Error(`${key} should be an array, but receive ${typeof value}`)
              }
              const items = value.map((item, i) => {
                const subtype = build(item)
                if (typeof subtype !== 'object') {
                  return subtype
                }
                const subcomments = subtype.__comments__
                if (subcomments) {
                  each(subcomments, (m, k) => {
                    comments[prop + '[' + i + ']' + '.' + k] = m
                  })
                }
                return subtype
              })
              return items
            }

            return build(value, prop)
          })

          const t = use.length ? use.reverse().map(char => customRules[char]).reduce((t, fn) => fn(t), type) : type
          res[prop] = t
        })

        return res
      }

      return build(target)
    })
    const type = Ty.create(pattern)
    type.__comments__ = comments

    return type
  }

  /**
   * type -> description
   * @param {object} dict
   * @param {object} options
   * @param {number} [options.arrayStyle] 1: "[string|number]" 2: ["string", "number"] default: "string[]|number[]"
   * @param {number} [options.ruleStyle] 1: { "name?": "string" } default: { "name": "?string" }
   * @returns
   */
  describe(dict, options = {}) {
    const __def__ = []
    const { arrayStyle, ruleStyle } = options

    const types = Object.entries(this.types)
    const getProto = (value) => {
      const type = types.find(item => item[1] === value)
      if (type) {
        return type[0]
      }
      if (isString(value)) {
        return value
      }
    }
    const define = (v, origin = false) => {
      if (v && typeof v === 'object') {
        const existing = __def__.find(item => isEqual(item.def, v))
        if (existing) {
          return existing.name
        }

        const i = __def__.length + 1
        const name = '$' + i
        const def = {
          name,
          def: v,
        }
        if (origin) {
          def.origin = true
        }
        __def__.push(def)
        return name
      }
      else {
        return v
      }
    }
    const buildList = (items, type = 0) => {
      return type === 2
        ? items.map(item => define(item) + '[]').join('|')
        : type === 1
          ? '[' + items.map(item => define(item)).join('|') + ']'
          : items.map(item => build(item))
    }

    const create = (value, rules = []) => {
      const proto = getProto(value)
      if (proto) {
        return proto
      }

      let sign = value
      if (isInstanceOf(value, Dict)) {
        sign = build(value.pattern)
      }
      else if (isInstanceOf(value, Tupl)) {
        const { pattern } = value
        const items = pattern.map(build)
        if (ruleStyle) {
          rules.push('*')
          sign = items
        }
        else {
          sign = '(' + items.map(item => define(item)).join(',') + ')'
        }
      }
      else if (isInstanceOf(value, List)) {
        const { pattern } = value
        const items = pattern.map(build)
        if (ruleStyle) {
          rules.push('|')
          sign = items
        }
        else {
          sign = buildList(items, arrayStyle)
        }
      }
      else if (isInstanceOf(value, Enum)) {
        const { pattern } = value
        const items = pattern.map(build)
        const desc = items.join('|')
        sign = desc
      }
      else if (isInstanceOf(value, Range)) {
        const { pattern } = value
        const { min, max, minBound, maxBound } = pattern
        const desc = `${min}${minBound ? '<' : ''}-${maxBound ? '>' : ''}${max}`
        sign = desc
      }
      else if (isInstanceOf(value, Mapping)) {
        const { pattern } = value
        const [k, v] = pattern
        const kp = build(k)
        const vp = build(v)
        const desc = `{${kp}:${vp}}`
        sign = desc
      }
      else if (isInheritedOf(value, SelfRef)) {
        const type = value.fn('__self__')
        sign = create(type)
      }
      else if (isInstanceOf(value, Rule)) {
        const { name, pattern } = value
        if (name === 'ifexist') {
          if (ruleStyle) {
            rules.push('?')
            sign = create(pattern, rules)
          }
          else {
            const inner = create(pattern)
            sign = '?' + define(inner)
          }
        }
        else if (name === 'equal') {
          if (ruleStyle) {
            rules.push('=')
            sign = create(pattern, rules)
          }
          else {
            const inner = create(pattern)
            sign = '=' + define(inner, true)
          }
        }
        else if (name === 'shouldnotmatch') {
          if (ruleStyle) {
            rules.push('!')
            sign = create(pattern, rules)
          }
          else {
            const inner = create(pattern)
            sign = '!' + define(inner)
          }
        }
        else if (name === 'nullable' || name === 'nonable') {
          if (ruleStyle) {
            rules.push('*')
            sign = create(pattern, rules)
          }
          else {
            const inner = create(pattern)
            sign = '*' + define(inner)
          }
        }
        else if (name === 'match') {
          const items = build(pattern)
          sign = items.join(',')
        }
        else if (name === 'asynchronous') {
          sign = create(pattern)
        }
        else if (name === 'shouldmatch') {
          sign = create(pattern)
        }
        else if (name === 'ifnotmatch') {
          sign = create(pattern)
        }
        else if (name === 'shouldexist') {
          const inner = create(pattern)
          sign = '?' + define(inner)
        }
        else if (name === 'shouldnotexist') {
          const inner = create(pattern)
          sign = '?' + define(inner)
        }
        else if (name === 'beof') {
          sign = create(pattern)
        }
        else if (name === 'lambda') {
          sign = 'function'
        }
        else {
          const items = build(pattern)
          sign = isArray(items) ? items.join('|') : items
        }
      }
      else if (isObject(value)) {
        sign = build(value)
      }
      else if (isArray(value)) {
        const items = build(value)
        const desc = buildList(items)
        sign = desc
      }

      return sign
    }
    const build = (type) => {
      const proto = getProto(type)
      if (proto) {
        return proto
      }

      const pattern = isInstanceOf(type, Type) || isInstanceOf(type, Rule) ? type.pattern : type
      const desc = isArray(pattern) ? [] : {}

      each(pattern, (value, key) => {
        const rules = []
        const sign = create(value, rules)
        const symb = rules.join('')
        desc[key + symb] = sign
      })
      return desc
    }

    const description = build(dict)
    if (__def__.length) {
      return { __def__, ...description }
    }
    else {
      return description
    }
  }

  guess(data) {
    const res = map(data, value => this.getType(value))
    return res
  }

  merge(exist, data) {
    const res = {}
    const checkedKeys = {}
    const existKeys = Object.keys(exist)

    const findKey = (key) => {
      const existKey = existKeys.find(item => new RegExp(`^${createSafeExp(key)}[?!&=|*]*$`).test(item))
      return existKey
    }

    each(data, (value, key) => {
      const prevKey = findKey(key)
      const hasKey = !!prevKey
      const next = this.getType(value)

      if (hasKey) {
        checkedKeys[prevKey] = 1

        // TODO 基于权重决定是应该替换部分，还是整体作为enum
        // TODO list -> tuple

        const prev = exist[prevKey]
        const prevRules = prevKey.replace(key, '')
        const isEnum = prevRules.indexOf('|') > -1
        if (isEnum && !isArray(prev)) {
          throw new Error(`${prevKey} in previous type description should be an array, but receive ${typeof prev}`)
        }

        const prevItems = isEnum ? prev : [].concat(prev)
        const inPrev = prevItems.some(item => isEqual(item, next))
        if (inPrev) {
          res[prevKey] = prev
          return
        }

        if (next === 'null' || next === 'undefined') {
          const isNonable = prevKey.indexOf('&') > -1
          const nextKey = isNonable ? prevKey : prevKey + '&'
          res[nextKey] = prev
          return
        }

        const nextKey = isEnum ? prevKey : prevKey + '|'
        prevItems.push(next)
        res[nextKey] = prevItems
      }
      else {
        checkedKeys[key] = 1
        res[key] = next
      }
    })

    each(exist, (value, key) => {
      if (checkedKeys[key]) {
        return
      }

      const isOptional = key.indexOf('?') > -1
      const nextKey = isOptional ? nextKey : key + '?'
      res[nextKey] = value
    })

    return res
  }

  getType(value) {
    if (isObject(value)) {
      return this.guess(value)
    }
    else if (isArray(value)) {
      return value.map(item => this.guess(item))
    }
    else if (isNull(value)) {
      return 'null'
    }
    else if (isUndefined(value)) {
      return 'undefined'
    }
    else if (isNaN(value)) {
      return 'nan'
    }
    else if (isNumeric(value)) {
      return 'numeric'
    }
    else {
      return typeof value
    }
  }

  static defaultTypes = {
    string: String,
    string8: String8,
    string16: String16,
    string32: String32,
    string64: String64,
    string128: String128,
    number: Number,
    boolean: Boolean,
    null: Null,
    undefined: Undefined,
    none: None,
    symbol: Symbol,
    function: Function,
    array: Array,
    object: Object,
    numeric: Numeric,
    int: Int,
    float: Float,
    negative: Negative,
    positive: Positive,
    zero: Zero,
    natural: Natural,
    any: Any,
    nan: NaN,
    infinity: Infinity,
    finity: Finity,
    date: Date,
    promise: Promise,
    error: Error,
    regexp: RegExp,
  }
}
