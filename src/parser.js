import Ty from './ty.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import Mapping from './mapping.js'
import Rule from './rule.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { ifexist, shouldnotmatch, equal, match } from './rules.js'
import { map, each, isInstanceOf, isArray, isObject, isString, isEqual, isFunction } from './utils.js'
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
   *   sex: 'F|M',
   *   dot: '=xxxxx', // equal
   *   belong: '?=animal', // ifexist equal
   *   vioce: '!number', // should not match
   *   num: 'string,numeric', // match multiple
   *   parents: ['string', 'string'], // tuple
   *   books: 'book[]', // list, use defined 'book'
   *   body: {
   *     head: 'boolean',
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
    const parse = (description) => {
      const exp = []

      const checkRule = () => {
        let firstChar = description.charAt(0)
        if (rules[firstChar]) {
          exp.push(rules[firstChar])
          description = description.substr(1)
          checkRule()
        }
      }
      checkRule()

      const items = description.split(',').map((word) => {
        const words = word.split('|').map((item) => {
          if (item.substr(-2) === '[]') {
            item = item.substr(0, item.length - 2)
            const prototype = types[item]
            return prototype ? new List([prototype]) : Array
          }
          else if (item.indexOf('-') > 0) {
            const [minStr, maxStr] = item.split(/<{0,1}\->{0,1}/)
            const min = +minStr
            const max = +maxStr
            const minBound = item.indexOf('<-') > 0
            const maxBound = item.indexOf('->') > 0
            return new Range({ min, max, minBound, maxBound })
          }
          else if (item.charAt(0) === '{' && item.substr(-1) === '}' && item.indexOf(':') > 0) {
            const [k, v] = item.split(/\{\:\}/).filter(item => !!item)
            const kp = types[k] || String
            const vp = types[v] || String
            const t = new Mapping([kp, vp])
            return t
          }
          else {
            const prototype = types[item]
            return prototype ? prototype : item
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

    const pattern = map(target, (description) => {
      if (isObject(description)) {
        return parser.parse(description)
      }
      else if (isArray(description)) {
        return new Tuple(description.map(item => parse(item)))
      }
      else if (isString(description)) {
        return parse(description)
      }
    })
    const type = Ty.create(pattern)
    return type
  }
  describe(dict) {
    const __def__ = []

    const types = Object.entries(this.types)
    const get = (value) => {
      if (isString(value)) {
        return value
      }
      const type = types.find(item => item[1] === value)
      return type ? type[0] : null
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

    const create = (value) => {
      let proto = get(value)
      if (!proto) {
        if (isInstanceOf(value, Dict)) {
          proto = build(value.pattern)
        }
        else if (isInstanceOf(value, Tuple)) {
          proto = build(value.pattern)
        }
        else if (isInstanceOf(value, List)) {
          const { pattern } = value
          const items = pattern.map(build)
          const desc = items.map(item => define(item) + '[]').join('|')
          proto = desc
        }
        else if (isInstanceOf(value, Enum)) {
          const { pattern } = value
          const items = pattern.map(build)
          const desc = items.join('|')
          proto = desc
        }
        else if (isInstanceOf(value, Range)) {
          const { pattern } = value
          const { min, max, minBound, maxBound } = pattern
          const desc = `${min}${minBound ? '<' : ''}-${maxBound ? '>' : ''}${max}`
          proto = desc
        }
        else if (isInstanceOf(value, Mapping)) {
          const { pattern } = value
          const [k, v] = pattern
          const kp = build(k)
          const vp = build(v)
          const desc = `{${kp}:${vp}}`
          proto = desc
        }
        else if (isInstanceOf(value, Rule)) {
          const { name, pattern } = value

          if (name === 'ifexist') {
            const inner = create(pattern)
            proto = '?' + define(inner)
          }
          else if (name === 'equal') {
            const inner = create(pattern)
            proto = '=' + define(inner, true)
          }
          else if (name === 'shouldnotmatch') {
            const inner = create(pattern)
            proto = '!' + define(inner)
          }
          else if (name === 'match') {
            const items = build(pattern)
            proto = items.join(',')
          }
          else if (name === 'asynchronous') {
            proto = create(pattern)
          }
          else if (name === 'determine') {
            const items = build(pattern)
            proto = items.join('|')
          }
          else if (name === 'shouldmatch') {
            proto = create(pattern)
          }
          else if (name === 'ifnotmatch') {
            proto = create(pattern)
          }
          else if (name === 'shouldexist') {
            const inner = create(pattern)
            proto = '?' + define(inner)
          }
          else if (name === 'shouldnotexist') {
            const inner = create(pattern)
            proto = '?' + define(inner)
          }
          else if (name === 'beof') {
            proto = create(pattern)
          }
          else if (name === 'lambda') {
            proto = 'function'
          }
          else {
            proto = ':' + name
          }
        }
        else if (isObject(value)) {
          proto = build(value)
        }
        else if (isArray(value)) {
          const items = build(value)
          const desc = items.map(item => define(item) + '[]').join('|')
          proto = desc
        }
      }
      return proto
    }
    const build = (type) => {
      const proto = get(type)
      if (proto) {
        return proto
      }

      const pattern = isInstanceOf(type, Type) || isInstanceOf(type, Rule) ? type.pattern : type
      const desc = isArray(pattern) ? [] : {}
      each(pattern, (value, key) => {
        const proto = create(value)
        desc[key] = proto
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
}

export default Parser

Parser.defaultTypes = {
  'string': String,
  'number': Number,
  'boolean': Boolean,
  'null': Null,
  'undefined': Undefined,
  'symbol': Symbol,
  'function': Function,
  'array': Array,
  'object': Object,
  'numeric': Numeric,
  'int': Int,
  'float': Float,
  'negative': Negative,
  'positive': Positive,
  'zero': Zero,
  'any': Any,
  'nn': NaN,
  'infinity': Infinity,
  'finity': Finity,
  'date': Date,
  'promise': Promise,
  'error': Error,
  'regexp': RegExp,
}
