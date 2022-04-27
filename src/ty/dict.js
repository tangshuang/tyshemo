import {
  isObject,
  isEmpty,
  getConstructorOf,
  each,
  inObject,
  isArray,
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

  extend(props = {}) {
    const current = this.pattern
    const next = { ...current, ...props }
    const Constructor = getConstructorOf(this)
    const type = new Constructor(next)
    return type
  }
  extract(props = {}) {
    const current = this.pattern
    const next = {}
    const isArr = isArray(props)
    each(props, (value, key) => {
      if (isArr && inObject(value, current)) {
        next[value] = current[value]
      }
      else if (value && inObject(key, current)) {
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
