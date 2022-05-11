import {
  isArray,
  isInstanceOf,
} from 'ts-fns'

import { Type } from './type.js'
import { TyError } from './ty-error.js'

export class Enum extends Type {
  constructor(...patterns) {
    const pattern = patterns.length > 1 ? patterns : patterns[0]

    if (!isArray(pattern)) {
      throw new Error('[Enum]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'Enum'
  }

  _decide(value) {
    const pattern = this.pattern
    const patterns = pattern
    const tyerr = new TyError()
    const errors = []

    for (let i = 0, len = patterns.length; i < len; i ++) {
      let pattern = patterns[i]
      // nested Type
      if (isInstanceOf(pattern, Type)) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        else if (!this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose) {
          pattern = pattern.loose
        }

        const error = pattern.catch(value)
        if (!error) {
          return null
        }
        else {
          errors.push(error)
        }
      }
      // normal validate
      else {
        const error = this.validate(value, pattern)
        if (!error) {
          return null
        }
        else {
          errors.push(error)
        }
      }
    }

    if (errors.length) {
      tyerr.replace({
        type: 'notin',
        value,
        name: this.name,
        pattern,
        errors,
      })
    }

    tyerr.commit()
    return tyerr
  }
}

export function enumerate(...patterns) {
  const type = new Enum(...patterns)
  return type
}
