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
    const Constructor = getConstructorOf(this)
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

    each(Constructor, (descriptor, key) => {
      if (Constructor === Meta && inArray(key, ['extend'])) {
        return
      }

      if (inObject(key, attrs, true)) {
        return
      }

      useAttr(key, descriptor, Constructor)
    }, true)

    each(attrs, (descriptor, key) => {
      useAttr(key, descriptor, attrs)
    }, true)

    this.onInit()
  }

  onInit() {}

  state() {
    return {}
  }

  extend(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...this, ...attrs }
    return new Constructor(finalAttrs)
  }

  static extend(attrs = {}) {
    const Constructor = inherit(this, {}, attrs)
    return Constructor
  }
}
export default Meta
