import Type from './type.js'
import Rule from './rule.js'
import { isInstanceOf, isArray, inObject } from './utils.js'
import TyError, { makeError } from './error.js'

export class Tuple extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new Error('[Tuple]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'Tuple'
  }
  catch(value) {
    const pattern = this.pattern
    const info = { value, params: [this.name, pattern], context: this }

    if (!isArray(value)) {
      return new TyError('mistaken', info)
    }

    const items = value
    const patterns = pattern
    const patternCount = patterns.length
    const itemCount = items.length

    if (this.isStrict && itemCount !== patternCount) {
      return new TyError('dirty', { length: itemCount, should: ['length', patternCount], context: this })
    }

    for (let i = 0; i < itemCount; i ++) {
      let value = items[i]
      let pattern = patterns[i]
      let index = i
      let info2 = { index, value, should: [pattern], context: this }

      let isRule = isInstanceOf(pattern, Rule)
      if (isRule) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }

        let error = pattern.validate(value, index, items)
        if (!error) {
          continue
        }

        // after validate, the property may create by validate
        if (!inObject(index, items)) {
          return new TyError('missing', { index, context: this })
        }

        return makeError(error, info2)
      }
      else {
        // not gave index
        if (!inObject(index, items)) {
          return new TyError('missing', { index, context: this })
        }
      }

      // nested type
      if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.catch(value)
        if (error) {
          return makeError(error, info2)
        }
      }
      // normal validate
      else {
        let error = this.validate(value, pattern)
        if (error) {
          return makeError(error, info2)
        }
      }
    }

    return null
  }
}

export function tuple(pattern) {
  const type = new Tuple(pattern)
  return type
}

export default Tuple
