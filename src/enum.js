import Type from './type.js'
import TyError from './error.js'
import { isArray } from './utils.js'

export class Enum extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new TyError('Enum pattern should be an array.')
    }

    super(pattern)
    this.name = 'Enum'
  }
  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }
    const patterns = pattern

    for (let i = 0, len = patterns.length; i < len; i ++) {
      let pattern = patterns[i]
      // nested Type
      if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.catch(value)
        if (!error) {
          return
        }
      }
      // normal validate
      else {
        let error = this.validate(value, pattern)
        if (!error) {
          return
        }
      }
    }

    throw new TyError('mistaken', info)
  }
}

export function enumerate(pattern) {
  const type = new Enum(pattern)
  return type
}

export default Enum
