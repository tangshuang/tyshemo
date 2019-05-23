import Type from './type.js'
import { isArray, isEmpty } from './utils.js'
import TyError, { makeError } from './error.js'
import Enum from './enum.js'

export class List extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new TyError('List pattern should be an array.')
    }

    if (isEmpty(pattern)) {
      pattern = Array
    }

    super(pattern)
    this.name = 'List'
  }
  assert(value) {
    const pattern = this.pattern
    const info = { type: this, level: 'type', action: 'assert' }

    if (!isArray(value)) {
      throw new TyError('mistaken', { ...info, value, pattern })
    }

    // can be empty array
    if (!value.length) {
      return null
    }

    let patterns = pattern
    let items = value

    pattern = new Enum(patterns)

    for (let i = 0, len = items.length; i < len; i ++) {
      let value = items[i]
      let error = pattern.catch(value)
      if (error) {
        throw makeError(error, { ...info, index: i, value, pattern })
      }
    }
  }
}

export function list(pattern) {
  const type = new List(pattern)
  return type
}

export default List
