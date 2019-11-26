import Type from './type.js'
import { isObject, isArray, each } from 'ts-fns'
import TyError from './ty-error.js'

export class Mapping extends Type {
  constructor(pattern = [String, String]) {
    if (!isArray(pattern)) {
      throw new Error('[Mapping]: pattern should be an array.')
    }
    if (pattern.length !== 2) {
      throw new Error('[Mapping]: pattern should has length of 2.')
    }

    super(pattern)
    this.name = 'Mapping'
  }

  catch(value) {
    const pattern = this.pattern
    const tyerr = new TyError()
    const [keyPattern, valuePattern] = pattern

    if (!isObject(value)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern: Object })
    }
    else {
      each(value, (value, key) => {
        const error = this.validate(key, keyPattern)
        if (error) {
          tyerr.add({ type: 'illegal', error, pattern: keyPattern, key })
        }

        const error2 = this.validate(value, valuePattern)
        if (error2) {
          tyerr.add({ type: 'exception', error: error2, key, pattern: valuePattern, value })
        }
      })
    }

    tyerr.commit()
    return tyerr.error()
  }
}

export function mapping(pattern) {
  const type = new Mapping(pattern)
  return type
}

export default Mapping
