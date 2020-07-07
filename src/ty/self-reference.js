import { isFunction } from 'ts-fns'
import Type from './type.js'
import { createType } from './rules.js'

export class SelfReference extends Type {
  constructor(fn) {
    if (!isFunction(fn)) {
      throw new Error('[SelfReference]: pattern should be a function.')
    }

    super(null)

    this.fn = fn
    this.name = 'SelfReference'
  }
  init() {
    if (!this.pattern) {
      const fn = this.fn
      const pattern = fn(this)
      this.pattern = pattern
    }
    return this
  }
  catch(value) {
    this.init()

    const type = createType(this.pattern)
    const error = type.catch(value)
    return error
  }
}

export function selfreference(fn) {
  const type = new SelfReference(fn)
  return type
}

export default SelfReference
