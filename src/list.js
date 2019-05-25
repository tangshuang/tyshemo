import Type from './type.js'
import { isArray, isEmpty } from './utils.js'
import TyError, { makeError } from './error.js'

export class List extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new TyError('List pattern should be an array.')
    }

    super(pattern)
    this.name = 'List'
  }
  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }

    if (!isArray(value)) {
      throw new TyError('mistaken', info)
    }
    
    if (isEmpty(pattern)) {
      return
    }

    const error = this.validate(value, pattern)
    if (error) {
      throw makeError(error, info)
    }
  }
}

export function list(pattern) {
  const type = new List(pattern)
  return type
}

export default List
