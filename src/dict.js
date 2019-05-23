import Type from './type.js'
import { isObject, getInterface, isArray } from './utils.js'
import TyError, { makeError } from './error.js'
import List from './list.js'

export class Dict extends Type {
  constructor(pattern) {
    if (!isObject(pattern)) {
      throw new TyError('Dict pattern should be an object.')
    }

    super(pattern)
    this.name = 'Dict'
  }

  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }

    if (!isObject(value)) {
      throw new TyError('mistaken', info)
    }

    const patterns = pattern
    const data = value
    const patternKeys = Object.keys(patterns)
    const dataKeys = Object.keys(data)

    // in strict mode, keys should absolutely equal
    // properties should be absolutely same
    if (this.isStrict) {
      for (let i = 0, len = dataKeys.length; i < len; i ++) {
        let key = dataKeys[i]
        if (!inArray(key, patternKeys)) {
          throw new TyError('overflow', { ...info, key })
        }
      }
      for (let i = 0, len = patternKeys.length; i < len; i ++) {
        let key = patternKeys[i]
        if (!inArray(key, dataKeys)) {
          throw new TyError('missing', { ...info, key })
        }
      }
    }

    for (let i = 0, len = patternKeys.length; i < len; i ++) {
      let key = patternKeys[i]
      let value = data[key]
      let pattern = patterns[key]
      let isRule = isInstanceOf(pattern, Rule)
      let error = null

      if (isRule) {
        if (this.isStrict && !pattern.isStrict) {
          pattern = pattern.strict
        }
        error = pattern.validate2(value, key, data)
        if (!error) {
          continue
        }
      }

      // not found some key in data
      // i.e. should be { name: String, age: Number } but give { name: 'tomy' }, 'age' is missing
      if (!inObject(key, data)) {
        throw new TyError('missing', { ...info, key })
      }

      // rule error
      // should come after not found, because the error of rule may caused by non-existing
      if (isRule && error) {
        throw makeError(error, { ...info, key, value, pattern })
      }

      // object
      if (isObject(pattern)) {
        pattern = new Dict(pattern)
        error = pattern.catch(value)
        if (error) {
          throw makeError(error, { ...info, key, value, pattern })
        }
        continue
      }

      // array
      if (isArray(pattern)) {
        pattern = new List(pattern)
        error = pattern.catch(value)
        if (error) {
          throw makeError(error, { ...info, key, value, pattern })
        }
        continue
      }

      // normal validate
      error = this.validate(value, pattern)
      if (error) {
        return makeError(error, { ...info, key, value, pattern })
      }
    }
  }

  extend(fields) {
    const current = this.pattern
    const next = Object.assign({}, current, fields)
    const Interface = getInterface(this)
    const type = new Interface(next)
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

    const Interface = getInterface(this)
    const type = new Interface(next)
    return type
  }
}

export function dict(pattern) {
  const type = new Dict(pattern)
  return type
}

export default Dict
