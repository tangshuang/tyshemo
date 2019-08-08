import Ty from './ty.js'
import Type from './type.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import Rule from './rule.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { ifexist, shouldnotmatch, equal, match } from './rules.js'
import { map, each, isInstanceOf, isArray, isObject, isString, isEqual } from './utils.js'

export class Parser {
  constructor(types) {
    this.init(types)
  }

  init(types = {}) {
    this.types = { ...Parser.defaultTypes, ...types }
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
    const parse = (def) => {
      const exp = []

      const checkRule = () => {
        let firstChar = def.charAt(0)
        if (rules[firstChar]) {
          exp.push(rules[firstChar])
          def = def.substr(1)
          checkRule()
        }
      }
      checkRule()

      const items = def.split(',').map((word) => {
        const words = word.split('|').map((item) => {
          const lastTwoChars = item.substr(-2)
          if (lastTwoChars === '[]') {
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
      __def__.forEach(({ name, def }) => {
        const type = parser.parse(def)
        types = { ...types, [name]: type }
        parser = new Parser(types)
      })
    }

    const pattern = map(target, (def) => {
      if (isObject(def)) {
        return parser.parse(def)
      }
      else if (isArray(def)) {
        return new Tuple(def.map(item => parse(item)))
      }
      else if (isString(def)) {
        return parse(def)
      }
    })
    const type = Ty.create(pattern)
    return type
  }
  describe(dict) {
    const { pattern } = dict
    const __def__ = []

    const types = Object.entries(this.types)
    const get = (value) => {
      if (isString(value)) {
        return value
      }
      const type = types.find(item => item[1] === value)
      return type ? type[0] : null
    }
    const define = (v) => {
      if (v && typeof v === 'object') {
        const i = __def__.length + 1
        const name = '$' + i
        __def__.push({
          name,
          def: v,
        })
        return name
      }
      else {
        const existing = __def__.find(item => isEqual(item.def, v))
        if (existing) {
          return existing.name
        }
        return v
      }
    }

    const build = (pattern) => {
      const proto = get(pattern)
      if (proto) {
        return proto
      }

      const description = isArray(pattern) ? [] : {}
      each(pattern, (value, key) => {
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
          else if (isInstanceOf(value, Rule)) {

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
        description[key] = proto
      })
      return description
    }

    const description = build(pattern)
    if (__def__.length) {
      description.__def__ = __def__
    }

    return description
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
