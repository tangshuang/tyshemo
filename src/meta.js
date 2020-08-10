import { getConstructorOf, inherit } from 'ts-fns'

export class Meta {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...Constructor, ...attrs }
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
