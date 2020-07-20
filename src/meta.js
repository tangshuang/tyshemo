import { getConstructorOf, extend } from 'ts-fns'

export class Meta {
  constructor(attrs = {}) {
    const Constructor = getConstructorOf(this)
    const finalAttrs = { ...Constructor, ...attrs }
    Object.assign(this, finalAttrs)
  }
  clone() {
    const finalAttrs = { ...this }
    return new Meta(finalAttrs)
  }
  extend(attrs = {}) {
    const finalAttrs = { ...this, ...attrs }
    return new Meta(finalAttrs)
  }

  static extends(attrs = {}) {
    const Constructor = extend(this, {}, attrs)
    return Constructor
  }
}
export default Meta
