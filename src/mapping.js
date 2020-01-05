import Type from './type.js'
import Ty from './ty.js'
import {
  isObject,
  isArray,
  each,
} from 'ts-fns'

import TyError from './ty-error.js'
import { Any } from './prototypes.js'

export class Mapping extends Type {
  constructor(pattern) {
    if (!Ty.is(pattern).of({ key: Any, value: Any })) {
      throw new Error('[Mapping]: pattern should be an object with { key, value }.')
    }

    super(pattern)
    this.name = 'Mapping'
  }

  catch(value) {
    const pattern = this.pattern
    const tyerr = new TyError()
    const { key: keyPattern, value: valuePattern } = pattern

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
