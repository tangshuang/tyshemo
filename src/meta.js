import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inArray,
  inObject,
  isArray,
  define,
  foreach,
  each,
} from 'ts-fns'
import Validator from './validator.js'

export class Meta {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const createValidators = (items) => {
      return items.map(v =>
        isInstanceOf(v, Validator) ? v
        : isInheritedOf(v, Validator) ? new v()
        : v && typeof v === 'object' ? new Validator(v)
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
      if (inArray(key, ['extend', 'attributes'])) {
        return
      }

      if (inObject(key, attrs)) {
        return
      }

      useAttr(key, descriptor, Constructor)
    }, true)

    // patch those which are static getter or setter
    const descriptors = Object.getOwnPropertyDescriptors(Constructor)
    each(descriptors, (descriptor, key) => {
      const { get, set } = descriptor
      if (!get && !set) {
        return
      }

      useAttr(key, descriptor, Constructor)
    })

    each(attrs, (descriptor, key) => {
      useAttr(key, descriptor, attrs)
    }, true)

    this.onInit()
  }

  onInit() {}

  extend(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...this, ...attrs }
    return new Constructor(finalAttrs)
  }

  static extend(attrs = {}) {
    const Constructor = inherit(this, {}, attrs)
    return Constructor
  }

  static attributes = {
    default: null,
    compute: null,
    type: null,
    message: null,
    validators: null,
    create: null,
    drop: null,
    map: null,
    flat: null,
    from: null,
    to: null,
    getter: null,
    setter: null,
    formatter: null,
    readonly: false,
    disabled: false,
    required: false,
    hidden: false,
    watch: null,
    catch: null,
  }
}
export default Meta
