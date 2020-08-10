import { getConstructorOf, inherit, map, isInstanceOf, isInheritedOf } from 'ts-fns'
import Validator from './validator.js'

export class Meta {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const mergedAttrs = { ...Constructor, ...attrs }
    const finalAttrs = map(mergedAttrs, (attr, key) => {
      if (key === 'validators') {
        return attr.map(v =>
          isInstanceOf(v, Validator) ? v
          : isInheritedOf(v, Validator) ? new v()
          : new Validator(v)
        )
      }
      else {
        return attr
      }
    })
    Object.assign(this, finalAttrs)
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
