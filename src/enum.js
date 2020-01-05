import {
  isArray,
  isInstanceOf,
} from 'ts-fns'

import Type from './type.js'
import TyError from './ty-error.js'

export class Enum extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new Error('[Enum]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'Enum'
  }
  catch(value) {
    const pattern = this.pattern
    const patterns = pattern
    const tyerr = new TyError()

    for (let i = 0, len = patterns.length; i < len; i ++) {
      let pattern = patterns[i]
      // nested Type
      if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        let error = pattern.catch(value)
        if (!error) {
          return null
        }
      }
      // normal validate
      else {
        let error = this.validate(value, pattern)
        if (!error) {
          return null
        }
      }
    }

    tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    tyerr.commit()
    return tyerr
  }
}

export function enumerate(pattern) {
  const type = new Enum(pattern)
  return type
}

export default Enum
