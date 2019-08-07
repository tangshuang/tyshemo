import Type from './type.js'
import Dict from './dict.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import Range from './range.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { each, isInstanceOf } from './utils.js'

export class Generator {
  constructor(types) {
    this.init(types)
  }
  init(types = {}) {
    this.types = { ...Generator.defaultTypes, ...types }
  }
  register(text, type) {
    this.types[text] = type
  }

  describe(dict) {
    const { pattern } = dict

    const types = Object.entries(this.types)
    const get = (value) => {
      const type = types.find(item => item[1] === value)
      return type ? type[0] : null
    }

    const build = (pattern) => {
      const description = {}
      each(pattern, (value, key) => {
        let proto = get(value)
        if (!proto) {
          if (isInstanceOf(value, Dict)) {
            proto = build(value.pattern)
          }
        }
        description[key] = proto
      })
      return description
    }

    const description = build(pattern)
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