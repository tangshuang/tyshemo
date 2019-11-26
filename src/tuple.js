import Type from './type.js'
import Rule from './rule.js'
import { isInstanceOf, isArray, inObject } from 'ts-fns'
import TyError from './ty-error.js'

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
        const pattern = patterns[i]
        const index = i

        const isRule = isInstanceOf(pattern, Rule)
        if (isRule) {
          if (this.isStrict && !pattern.isStrict) {
            pattern = pattern.strict
          }

          const error = pattern.validate(value, index, items)
          if (!error) {
            continue
          }

          // after validate, the property may create by validate
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

export function tuple(pattern) {
  const type = new Tuple(pattern)
  return type
}

export default Tuple
