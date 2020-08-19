import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inArray,
  inObject,
  isArray,
  define,
  each,
  isEmpty,
} from 'ts-fns'
import Validator from './validator.js'

export class Meta {
  constructor(attrs = {}) {
    const createValidators = (items) => {
      return items.map(v =>
        isInstanceOf(v, Validator) ? v
        : isInheritedOf(v, Validator) ? new v()
        : v && typeof v === 'object' && !isEmpty(v) ? new Validator(v)
        : null
      ).filter(v => !!v)
    }
    const useAttr = (key, descriptor, context) => {
      const { value, get, set } = descriptor

      if (key === 'validators') {
        const items = value ? value : get ? get.call(context) : null
        this.validators = isArray(items) ? createValidators(items) : []
        return
      }

      if (get || set) {
        define(this, key, {
          get,
          set,
          enumerable: true,
          configurable: true,
        })
      }
      else {
        this[key] = value
      }
    }

    const push = (ins) => {
      const Constructor = getConstructorOf(ins)

      if (Constructor === Meta) {
        return
      }

      const Parent = getConstructorOf(Constructor.prototype)
      if (isInheritedOf(Parent, Meta)) {
        push(Constructor.prototype)
      }

      each(Constructor, (descriptor, key) => {
        if (inObject(key, attrs, true)) {
          return
        }

        useAttr(key, descriptor, Constructor)
      }, true)
    }
    push(this)

    each(attrs, (descriptor, key) => {
      useAttr(key, descriptor, attrs)
    }, true)

    this.onInit()
  }

  onInit() {}

  state() {
    return {}
  }

  extend(attrs) {
    const Constructor = getConstructorOf(this)
    return new Constructor(attrs)
  }

  static extend(attrs) {
    const Constructor = inherit(this, null, attrs)
    return Constructor
  }
}
export default Meta
