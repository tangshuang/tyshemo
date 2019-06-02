import Type from './type.js'
import { isArray, isEmpty } from './utils.js'
import TyError, { makeError } from './error.js'

export class List extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new Error('[List]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'List'
  }
  catch(value) {
    const pattern = this.pattern
    const info = { value, should: [this.name, pattern], context: this }

    if (!isArray(value)) {
      return new TyError('mistaken', info)
    }

    if (isEmpty(pattern)) {
      return null
    }

    const error = this.validate(value, pattern)
    return makeError(error, info)
  }
}

export function list(pattern) {
  const type = new List(pattern)
  return type
}

export default List
