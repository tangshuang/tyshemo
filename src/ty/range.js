import {
  inObject,
  isObject,
  isNumber,
} from 'ts-fns'

import { Type } from './type.js'
import { TyError } from './ty-error.js'

export class Range extends Type {
  constructor(pattern) {
    if (!isObject(pattern)) {
      throw new Error('[Range]: pattern should be an object.')
    }

    if (!inObject('min', pattern)) {
      throw new Error('[Range]: min should be in pattern.')
    }

    if (!inObject('max', pattern)) {
      throw new Error('[Range]: max should be in pattern.')
    }

    super(pattern)
    this.name = 'Range'
  }

  _decide(value) {
    const pattern = this.pattern
    const tyerr = new TyError()
    const { min, max, minBound = true, maxBound = true } = pattern

    if (!isNumber(value)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else if ((minBound && value < min) || (!minBound && value <= min)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else if ((maxBound && value > max) || (!maxBound && value >= max)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else {
      return null
    }

    tyerr.commit()
    return tyerr.error()
  }
}

export function range(pattern) {
  const type = new Range(pattern)
  return type
}
