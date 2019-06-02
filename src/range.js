import Type from './type.js'
import { inObject, isObject, isNumber } from './utils.js'
import TyError from './error.js'

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
  }
  catch(value) {
    const pattern = this.pattern
    const info = { value, should: ['Range', pattern], context: this }

    if (!isNumber(value)) {
      return new TyError('mistaken', info)
    }

    const { min, max, minBound, maxBound } = pattern

    if ((minBound && value < min) || (!minBound && value <= min)) {
      return new TyError('mistaken', info)
    }
    else if ((maxBound && value > max) || (!maxBound && value >= max)) {
      return new TyError('mistaken', info)
    }
    else {
      return null
    }
  }
}

export default Range

export function range(pattern) {
  const type = new Range(pattern)
  return type
}
