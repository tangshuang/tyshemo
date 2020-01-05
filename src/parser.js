import {
  isInstanceOf,
  isArray,
  isObject,
  isString,
  isEqual,
  isInheritedOf,
  map,
  each,
} from 'ts-fns'

import Ty from './ty.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import Mapping from './mapping.js'
import Rule from './rule.js'
import Model from './model.js'
import {
  Null,
  Undefined,
  Any,
  Numeric,
  Int,
  Float,
  Negative,
  Positive,
  Zero,
  Finity,
  Natural,
  String8,
  String16,
  String32,
  String64,
  String128,
} from './prototypes.js'
import {
  ifexist,
  shouldnotmatch,
  equal,
  match,
} from './rules.js'
import Type from './type.js'

export class Parser {
  constructor(types) {
    this.init(types)
  }

  init(types = {}) {
    this.types = { ...Parser.defaultTypes, ...types }
  }

  define(target, text) {
    this.types[text] = target
    return this
  }

  /**
   * parse idl by using string
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

    const rules = {
      '?': ifexist,
      '=': equal,
      '!': shouldnotmatch,
    }
    const parse = (text) => {
      const exp = []

      const checkRule = () => {
        let firstChar = text.charAt(0)
        if (rules[firstChar]) {
          exp.push(rules[firstChar])
          text = text.substr(1)
          checkRule()
        }
      }
      checkRule()

      // prepare for '(a,b)' and '[a|b]'
      text = text.replace(/\[.*\]/g, (item) => {
        return item.replace(/\|/g, '::')
      })
      text = text.replace(/\(.*\)/g, (item) => {
        return item.replace(/,/g, '::')
      })
      const items = text.split(',').map((word) => {
        const words = word.split('|').map((item) => {
          // tuple (a,b)
          if (item.charAt(0) === '(' && item.substr(-1) === ')') {
            item = item.substr(1, item.length - 2)
            const texts = item.split('::')
            const prototypes = texts.map(item => parse(item))
            return new Tuple(prototypes)
          }
          // list [a|b]
          else if (item.charAt(0) === '[' && item.substr(-1) === ']') {
            item = item.substr(1, item.length - 2)
            // empty list []
            if (!item) {
              return Array
            }
            const texts = item.split('::')
            const prototypes = texts.map(item => parse(item))
            return new List(prototypes)
          }
          // list a[]
          else if (item.substr(-2) === '[]') {
            item = item.substr(0, item.length - 2)
            const prototype = types[item] || item
            return prototype ? new List([prototype]) : Array
          }
          // range 10<-20
          else if (item.indexOf('-') > 0) {
            const [minStr, maxStr] = item.split(/<{0,1}\->{0,1}/)
            const min = +minStr
            const max = +maxStr
            const minBound = item.indexOf('<-') > 0
            const maxBound = item.indexOf('->') > 0
            return new Range({ min, max, minBound, maxBound })
          }
          // mapping {string:array}
          else if (item.charAt(0) === '{' && item.substr(-1) === '}' && item.indexOf(':') > 0) {
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

    let parser = this
    const target = { ...description }
    const { __def__ } = target
    delete target.__def__

    if (__def__) {
      __def__.forEach(({ name, def, origin }) => {
        const type = origin ? def : parser.parse(def)
        types = { ...types, [name]: type }
        parser = new Parser(types)
      })
    }

    const comments = {}
    const build = (value, key) => {
      if (key && key.indexOf('#') === 0) {
        comments[key.substr(2)] = value
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
    const pattern = map(target, build)
    const type = Ty.create(pattern)
    type.__comments__ = comments
    return type
  }
  describe(dict, options = {}) {
    const __def__ = []
    const { arrayStyle } = options

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
        ? items.map(item => define(item) + '[]').join(',')
        : type === 1
          ? '[' + items.map(item => define(item)).join(',') + ']'
          : items.map(item => build(item))
    }

    const create = (value) => {
      const proto = getProto(value)
      if (proto) {
        return proto
      }

      let sign = value
      if (isInheritedOf(value, Model)) {
        const schemaFn = value.prototype.schema
        const schema = schemaFn()
        const pattern = map(schema, (node) => {
          const { type } = node
          return type
        })
        sign = build(pattern)
      }
      if (isInstanceOf(value, Dict)) {
        sign = build(value.pattern)
      }
      else if (isInstanceOf(value, Tuple)) {
        const { pattern } = value
        const items = pattern.map(build)
        const desc = '(' + items.map(item => define(item)).join(',') + ')'
        sign = desc
      }
      else if (isInstanceOf(value, List)) {
        const { pattern } = value
        const items = pattern.map(build)
        const desc = buildList(items, arrayStyle)
        sign = desc
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
      else if (isInstanceOf(value, Rule)) {
        const { name, pattern } = value
        if (name === 'ifexist') {
          const inner = create(pattern)
          sign = '?' + define(inner)
        }
        else if (name === 'equal') {
          const inner = create(pattern)
          sign = '=' + define(inner, true)
        }
        else if (name === 'shouldnotmatch') {
          const inner = create(pattern)
          sign = '!' + define(inner)
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

      if (isInheritedOf(type, Model)) {
        const schemaFn = type.prototype.schema
        const schema = schemaFn()
        type = map(schema, (node) => {
          const { type } = node
          return type
        })
      }

      const pattern = isInstanceOf(type, Type) || isInstanceOf(type, Rule) ? type.pattern : type
      const desc = isArray(pattern) ? [] : {}

      each(pattern, (value, key) => {
        const sign = create(value)
        desc[key] = sign
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
    nn: NaN,
    infinity: Infinity,
    finity: Finity,
    date: Date,
    promise: Promise,
    error: Error,
    regexp: RegExp,
  }
}

export default Parser
