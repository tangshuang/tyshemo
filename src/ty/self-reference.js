import { isFunction } from 'ts-fns'
import Type from './type.js'
import { createType } from './rules.js'

export class SelfReference extends Type {
  constructor(fn) {
    if (!isFunction(fn)) {
      throw new Error('[SelfReference]: pattern should be a function.')
    }

    super(fn)

    this.name = 'SelfReference'
  }
  catch(value) {
    const fn = this.pattern
    const pattern = fn(this)
    const type = createType(pattern)
    const error = type.catch(value)
    return error
  }
}

export function selfreference(fn) {
  const type = new SelfReference(fn)
  return type
}

export default SelfReference
