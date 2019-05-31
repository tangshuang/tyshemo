import Type from './type.js'
import { isObject, getConstructor, isEmpty } from './utils.js'
import TyError, { makeError } from './error.js'

export class Dict extends Type {
  constructor(pattern) {
    if (!isObject(pattern)) {
      throw new Error('[Dict]: pattern should be an object.')
    }

    super(pattern)
    this.name = 'Dict'
  }

  catch(value) {
    const pattern = this.pattern
    const info = { value, should: [this.name, pattern], context: this }

    if (!isObject(value)) {
      return new TyError('mistaken', info)
    }

    if (isEmpty(pattern)) {
      return null
    }

    const error = this.validate(value, pattern)
    if (error) {
      return makeError(error, info)
    }
  }

  extend(fields) {
    const current = this.pattern
    const next = Object.assign({}, current, fields)
    const Constructor = getConstructor(this)
    const type = new Constructor(next)
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

    const Constructor = getConstructor(this)
    const type = new Constructor(next)
    return type
  }
}

export function dict(pattern) {
  const type = new Dict(pattern)
  return type
}

export default Dict
