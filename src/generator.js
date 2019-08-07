import Type from './type.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { each, isInstanceOf, isArray, isObject, isString } from './utils.js'

export class Generator {
  constructor(types) {
    this.init(types)
  }
  init(types = {}) {
    this.types = { ...Generator.defaultTypes, ...types }
  }
  define(target, description) {
    this.types[description] = target
  }

  describe(dict) {
    const { pattern } = dict
    const $_def = []

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
        const i = $_def.length + 1
        const name = '$' + i
        $_def.push({
          name,
          def: v,
        })
        return name
      }
      else {
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
            const desc = `${minBound ? '[' : '('}${min},${max}${maxBound ? ']' : ')'}`
            proto = desc
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
    if ($_def.length) {
      description.$_def = $_def
    }

    return description
  }
  graphql(dict) {}
}

Generator.defaultTypes = {
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

export default Generator
