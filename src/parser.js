import Ty from './ty.js'
import List from './list.js'
import Enum from './enum.js'
import Tuple from './tuple.js'
import { Null, Undefined, Numeric, Int, Float, Negative, Positive, Zero, Any, Finity } from './prototypes.js'
import { ifexist, shouldnotmatch, equal, match } from './rules.js'
import { map, isArray, isObject, isString } from './utils.js'

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
   *   $_def: [
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

      const items = def.split(',').map((word) => {
        const words = word.split('|').map((item) => {
          const lastTwoChars = item.substr(-2)
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
    const { $_def } = target
    delete target.$_def

    if ($_def) {
      $_def.forEach(({ name, def }) => {
        const type = parser.parse(def)
        parser = new Parser({ ...types, [name]: type })
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
