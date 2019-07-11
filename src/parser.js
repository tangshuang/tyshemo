import Ty from './ty.js'
import List from './list.js'
import Enum from './enum.js'
import Rule from './rule.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { ifexist, shouldnotmatch, equal } from './rules.js'
import { map, isArray, isObject, isString, inObject, isInstanceOf, inArray } from './utils.js'
import Type from './type.js'

export class Parser {
  constructor(types = {}) {
    this.types = { ...Parser.defaultTypes, ...types }
  }

  // structure may be from backend through restful api
  parse(structure) {
    const types = this.types
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

      const items = def.split('|').map((item) => {
        let lastTwoChars = item.substr(-2)
        if (lastTwoChars === '[]') {
          item = item.substr(0, item.length - 2)
          const prototype = types[item]
          return prototype ? new List([prototype]) : Array
        }
        else {
          const prototype = types[item]
          return prototype ? prototype : item
        }
      })

      const type = items.length > 1 ? new Enum(items) : items[0]

      exp.reverse()

      let pattern = type
      exp.forEach((rule) => {
        pattern = rule(pattern)
      })

      return pattern
    }

    const pattern = map(structure, (def) => {
      if (isArray(def) || isObject(def)) {
        return this.parse(def)
      }
      else if (isString(def)) {
        return parse(def)
      }
    })
    const type = Ty.create(pattern)
    return type
  }

  json(type) {
    const types = this.types
    const rules = {
      ifexist: '?',
      equal: '=',
      shouldnotmatch: '!',
    }
    const strs = Object.keys(types)
    const pros = Object.values(types)

    const getPattern = (type) => {
      let { pattern } = type
      if (isInstanceOf(pattern, Type) || isInstanceOf(pattern, Rule)) {
        pattern = getPattern(pattern)
      }
      return pattern
    }
    const getJSON = (pattern) => {
      const json = map(pattern, (def) => {
        let str = ''
        if (isInstanceOf(def, Rule)) {
          const { name, pattern } = def
          if (rules[name]) {
            str += rules[name]
          }
          const proto = getPattern(pattern)
          const index = pros.findIndex(item => item === proto || (isNaN(item) && isNaN(proto)))
          const alias = index > -1 ? strs[index] : ''
          str += alias
        }
        else if (isInstanceOf(def, Type)) {
          const { name, pattern } = def
          const subpattern = getJSON(pattern)
        }
      })
      return json
    }

    const pattern = getPattern(type)
    const json = getJSON(pattern)
    return json
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
