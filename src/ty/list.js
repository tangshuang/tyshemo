import {
  isArray,
  isEmpty,
} from 'ts-fns'

import Type from './type.js'
import TyError from './ty-error.js'

export class List extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new Error('[List]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'List'
  }

  _decide(value) {
    const pattern = this.pattern
    const tyerr = new TyError()

    if (!isArray(value)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else if (isEmpty(pattern)) {
      return null
    }
    else {
      const error = this.validate(value, pattern)
      if (error) {
        tyerr.replace(error)
      }
    }

    tyerr.commit()
    return tyerr.error()
  }
}

export function list(pattern) {
  const type = new List(pattern)
  return type
}

export default List
