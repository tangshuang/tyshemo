import { isFunction, getConstructorOf } from 'ts-fns'
import Type from './type.js'
import { createType } from './rules.js'

export class SelfRef extends Type {
  constructor(fn) {
    if (!isFunction(fn)) {
      throw new Error('[SelfRef]: pattern should be a function.')
    }

    super(null)

    this.fn = fn
    this.name = 'SelfRef'
    this.pattern = fn(this)
  }

  _decide(value) {
    const type = createType(this.pattern)
    const error = type.catch(value)
    return error
  }

  clone() {
    const Constructor = getConstructorOf(this)
    const ins = new Constructor(this.fn)
    return ins
  }
}

export function selfref(fn) {
  const type = new SelfRef(fn)
  return type.init()
}

export default SelfRef
