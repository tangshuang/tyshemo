import {
  isInstanceOf,
  isArray,
  inObject,
} from 'ts-fns'

import { Type } from './type.js'
import { Rule } from './rule.js'
import { TyError } from './ty-error.js'

export class Tupl extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new Error('[Tupl]: pattern should be an array.')
    }

    super(pattern)
    this.name = 'Tupl'
  }

  _decide(value) {
    const pattern = this.pattern
    const tyerr = new TyError()

    const items = value
    const patterns = pattern

    if (!isArray(value)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else if (this.isStrict && items.length != patterns.length) {
      tyerr.replace({ type: 'dirty', value, name: this.name, pattern })
    }
    else {
      for (let i = 0, len = patterns.length; i < len; i ++) {
        const value = items[i]
        let pattern = patterns[i]
        const index = i

        const isRule = isInstanceOf(pattern, Rule)
        if (isRule) {
          const rule = this.isStrict && !pattern.isStrict ? pattern.strict
            : !this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose ? pattern.loose
              : pattern
          const error = rule.catch(items, index)
          if (!error) {
            continue
          }

          // after validate, the property may create by rule
          if (!inObject(index, items)) {
            tyerr.add({ type: 'missing', index })
          }
          else {
            tyerr.add({ error, index })
          }
        }
        else if (!inObject(index, items)) {
          tyerr.add({ type: 'missing', index })
        }
        // nested type
        else if (isInstanceOf(pattern, Type)) {
          if (this.isStrict && !pattern.isStrict) {
            pattern = pattern.strict
          }
          else if (!this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose) {
            pattern = pattern.loose
          }

          let error = pattern.catch(value)
          if (error) {
            tyerr.add({ error, index })
          }
        }
        // normal validate
        else {
          let error = this.validate(value, pattern)
          if (error) {
            tyerr.add({ error, index })
          }
        }
      }
    }

    tyerr.commit()

    return tyerr.count ? tyerr : null
  }
}

export function tupl(pattern) {
  const type = new Tupl(pattern)
  return type
}
