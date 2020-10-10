import {
  isObject,
  isEmpty,
  getConstructorOf,
  each,
  inObject,
} from 'ts-fns'

import Type from './type.js'
import TyError from './ty-error.js'

export class Dict extends Type {
  constructor(pattern) {
    if (!isObject(pattern)) {
      throw new Error('[Dict]: pattern should be an object.')
    }

    super(pattern)
    this.name = 'Dict'
  }

  _decide(value) {
    const pattern = this.pattern
    const tyerr = new TyError()

    if (isEmpty(pattern)) {
      return null
    }
    else if (!isObject(value)) {
      tyerr.replace({ type: 'exception', value, name: this.name, pattern })
    }
    else {
      const error = this.validate(value, pattern)
      if (error) {
        tyerr.replace(error)
      }
    }

    tyerr.commit()
    return tyerr.error()
  }

  extend(fields = {}) {
    const current = this.pattern
    const next = { ...current, ...fields }
    const Constructor = getConstructorOf(this)
    const type = new Constructor(next)
    return type
  }
  extract(fields = {}) {
    const current = this.pattern
    const next = {}
    each(fields, (value, key) => {
      if (value && inObject(key, current)) {
        next[key] = current[key]
      }
    })
    const Constructor = getConstructorOf(this)
    const type = new Constructor(next)
    return type
  }
}

export function dict(pattern) {
  const type = new Dict(pattern)
  return type
}

export default Dict
