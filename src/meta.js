import { getConstructorOf, inherit, map, isInstanceOf, isInheritedOf, isObject, filter } from 'ts-fns'
import Validator from './validator.js'

export class Meta {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const constructorAttrs = { ...Constructor }
    // remove extend method
    delete constructorAttrs.extend

    const mergedAttrs = { ...constructorAttrs, ...attrs }
    const finalAttrs = map(mergedAttrs, (attr, key) => {
      if (key === 'validators') {
        return attr.map(v =>
          isInstanceOf(v, Validator) ? v
          : isInheritedOf(v, Validator) ? new v()
          : v && typeof v === 'object' ? new Validator(v)
          : null
        ).filter(v => !!v)
      }
      else {
        return attr
      }
    })
    Object.assign(this, finalAttrs)
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
