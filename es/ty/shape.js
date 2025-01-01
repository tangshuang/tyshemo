import {
  isArray,
} from 'ts-fns'

import { Type } from './type.js'
import { TyError } from './ty-error.js'

export class Shape extends Type {
  constructor(pattern) {
    super(pattern)
    this.name = 'Shape'
  }

  _decide(value) {
    const pattern = this.pattern
    const tyerr = new TyError()

    if (!(value && typeof value === 'object')) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else {
      const v = isArray(value) ? [...value] : { ...value }
      const error = this.validate(v, pattern)
      if (error) {
        tyerr.replace(error)
      }
    }

    tyerr.commit()
    return tyerr.error()
  }
}

export function shape(pattern) {
  const type = new Shape(pattern)
  return type
}
