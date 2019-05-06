import Type from './type.js'
import { isObject, isInstanceOf } from './utils.js'
import TySheMoError, { makeError } from './error.js'

export class Dict extends Type {
  constructor(pattern) {
    if (!isObject(pattern)) {
      throw new TySheMoError('Dict pattern should be an object.')
    }

    super(pattern)
    this.name = 'Dict'
  }

  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }

    if (!isObject(value)) {
      throw new TySheMoError('mistaken', info)
    }

    const error = this.validate(value, pattern)
    if (error) {
      throw makeError(error, info)
    }
  }

  extend(fields) {
    const current = this.pattern
    const next = Object.assign({}, current, fields)
    const type = new Dict(next)
    return type
  }
  extract(fields) {
    const current = this.pattern
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        next[key] = current[key]
      }
    })

    const type = new Dict(next)
    return type
  }
  mix(fields) {
    const current = this.pattern
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        next[key] = current[key]
      }
      else if (isObject(fields[key]) || isInstanceOf(fields[key], Type)) {
        next[key] = fields[key]
      }
    })

    const type = new Dict(next)
    return type
  }
}

export function dict(pattern) {
  const type = new Dict(pattern)
  return type
}

export default Dict
