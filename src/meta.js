import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inObject,
  isArray,
  define,
  each,
  isEmpty,
} from 'ts-fns'
import Validator from './validator.js'
import { ofChain } from './shared/utils.js'

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

    const properties = ofChain(this, Meta)

    each(properties, (descriptor, key) => {
      if (inObject(key, attrs, true)) {
        return
      }
      useAttr(key, descriptor, properties)
    }, true)

    each(attrs, (descriptor, key) => {
      useAttr(key, descriptor, attrs)
    }, true)
  }

  extend(attrs) {
    const Constructor = getConstructorOf(this)
    return new Constructor(attrs)
  }

  static extend(attrs) {
    const Constructor = inherit(this, null, attrs)
    return Constructor
  }

  static extract(attrs, protos) {
    class Child extends Meta {}

    const Parent = this

    if (attrs) {
      each(attrs, (value, key) => {
        if (!value) {
          return
        }
        const descriptor = Object.getOwnPropertyDescriptor(Parent, key)
        define(Child, key, descriptor)
      })
    }

    if (protos) {
      each(protos, (proto, key) => {
        if (!proto) {
          return
        }
        const descriptor = Object.getOwnPropertyDescriptor(Parent.prototype, key)
        define(Child.prototype, key, descriptor)
      })
    }

    if (Child.name !== Parent.name) {
      const name = Object.getOwnPropertyDescriptor(Parent, 'name')
      define(Child, 'name', {
        ...name,
        enumerable: !!metas.name,
        configurable: true,
      })
    }

    return Child
  }
}
export default Meta
