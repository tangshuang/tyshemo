import Prototype from './prototype.js'
import Rule from './rule.js'
import TyError, { makeError } from './error.js'
import { isArray, isObject, isInstanceOf, inArray, getInterface, inObject } from './utils.js'

export class Type {

  /**
   * create a Type instance
   * @param  {Any} pattern should be native prototypes or a Rule instance, i.e. String, Number, Boolean... Null, Any, Float...
   */
  constructor(pattern) {
    this.isStrict = false
    this.pattern = pattern
    this.name =  'Type'
  }

  /**
   * validate whether the argument match the pattern
   * @param {*} value
   * @param {*} pattern
   */
  validate(value, pattern) {
    if (arguments.length === 1) {
      pattern = this.pattern
    }

    const info = { type: this, level: 'type', action: 'validate' }

    // nested Type
    if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      let error = pattern.catch(value)
      return makeError(error, info)
    }

    // check object
    if (isObject(pattern)) {
      if (!isObject(value)) {
        return new TyError('mistaken', { ...info, value, pattern })
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
            return new TyError('overflow', { ...info, key })
          }
        }
        for (let i = 0, len = patternKeys.length; i < len; i ++) {
          let key = patternKeys[i]
          if (!inArray(key, dataKeys)) {
            return new TyError('missing', { ...info, key })
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
          return new TyError('missing', { ...info, key })
        }

        // rule error
        // should come after not found, because the error of rule may caused by non-existing
        if (isRule) {
          return makeError(error, { ...info, key, value, pattern })
        }

        // normal validate
        error = this.validate(value, pattern)
        if (error) {
          return makeError(error, { ...info, key, value, pattern })
        }
      }

      return null
    }

    // check prototypes
    if (Prototype.can(pattern)) {
      const res = Prototype.is(value).of(pattern)
      if (res === true) {
        return null
      }
      else if (res === false) {
        return new TyError('mistaken', info)
      }
    }

    // check single value
    if (value === pattern) {
      return null
    }

    return new TyError('mistaken', info)
  }

  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }
    const error = this.validate(value, pattern)
    if (error) {
      throw makeError(error, info)
    }
  }
  catch(value) {
    try {
      this.assert(value)
      return null
    }
    catch (error) {
      return error
    }
  }
  test(value) {
    let error = this.catch(value)
    return !error
  }

  /**
   * track value with type sync
   * @param {*} value
   */
  track(value) {
    return new Promise((resolve, reject) => {
      let error = this.catch(value)
      if (error) {
        reject(error)
      }
      else {
        resolve()
      }
    })
  }

  /**
   * track value with type async
   * @param {*} value
   */
  trace(value) {
    return new Promise((resolve, reject) => {
      Promise.resolve().then(() => {
        let error = this.catch(value)
        if (error) {
          reject(error)
        }
        else {
          resolve()
        }
      })
    })
  }

  clone() {
    const Interface = getInterface(this)
    const ins = new Interface(this.pattern)
    return ins
  }

  toBeStrict(mode = true) {
    this.isStrict = !!mode
    return this
  }

  get strict() {
    const ins = this.clone()
    ins.toBeStrict()
    return ins
  }
  get Strict() {
    return this.strict
  }

  // use name when convert to string
  toString() {
    return this.name
  }

}

export function type(pattern) {
  const type = new Type(pattern)
  return type
}

export default Type
