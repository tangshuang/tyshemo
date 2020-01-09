import {
  isArray,
  isObject,
  isInstanceOf,
  inArray,
  inObject,
  getConstructor,
} from 'ts-fns'

import Prototype from './prototype.js'
import Rule from './rule.js'
import TyError from './ty-error.js'

export class Type {

  /**
   * create a Type instance
   * @param  {Any} pattern should be native prototypes or a Rule instance, i.e. String, Number, Boolean... Null, Any, Float...
   */
  constructor(pattern) {
    this.isStrict = false
    this.pattern = pattern
    this.name = 'Type'
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

    const tyerr = new TyError()

    // check array
    if (isArray(pattern)) {
      if (!isArray(value)) {
        tyerr.replace({ type: 'exception', value, name: 'List', pattern })
      }
      // can be empty array
      else if (value.length) {
        const patterns = pattern
        const values = value
        const count = values.length
        const enumerate = (value, patterns) => {
          const errors = []
          for (let i = 0, len = patterns.length; i < len; i ++) {
            let pattern = patterns[i]
            // nested Type
            if (isInstanceOf(pattern, Type)) {
              if (this.isStrict && !pattern.isStrict) {
                pattern = pattern.strict
              }
              const error = pattern.catch(value)
              if (!error) {
                return null
              }
              else {
                errors.push(error)
              }
            }
            // normal validate
            else {
              const error = this.validate(value, pattern)
              if (!error) {
                return null
              }
              else {
                errors.push(error)
              }
            }
          }
          return errors
        }

        for (let i = 0; i < count; i ++) {
          const value = values[i]
          const errors = enumerate(value, patterns)
          if (errors) {
            tyerr.add({
              type: 'exception',
              index: i,
              value,
              name: 'Enum',
              pattern: patterns,
              enum: errors,
            })
          }
        }
      }
    }
    // check object
    else if (isObject(pattern)) {
      if (!isObject(value)) {
        tyerr.replace({ type: 'exception', value, name: 'Dict', pattern })
      }
      else {
        const patterns = pattern
        const data = value
        const patternKeys = Object.keys(patterns)
        const dataKeys = Object.keys(data)

        // in strict mode, keys should absolutely equal
        // properties should be absolutely same
        if (this.isStrict) {
          for (let i = 0, len = dataKeys.length; i < len; i ++) {
            const key = dataKeys[i]
            if (!inArray(key, patternKeys)) {
              tyerr.add({ type: 'overflow', key })
            }
          }
        }

        for (let i = 0, len = patternKeys.length; i < len; i ++) {
          const key = patternKeys[i]
          const value = data[key]

          let pattern = patterns[key]

          const isRule = isInstanceOf(pattern, Rule)
          if (isRule) {
            if (this.isStrict && !pattern.isStrict) {
              pattern = pattern.strict
            }

            const error = pattern.validate(value, key, data)
            if (!error) {
              continue
            }

            // after validate, the property may create by validate
            if (!inObject(key, data)) {
              tyerr.add({ type: 'missing', key })
            }
            else {
              tyerr.add({ error, key })
            }
          }
          // not found some key in data
          // i.e. should be { name: String, age: Number } but give { name: 'tomy' }, 'age' is missing
          else if (!inObject(key, data)) {
            tyerr.add({ type: 'missing', key })
          }
          // nested Type
          else if (isInstanceOf(pattern, Type)) {
            if (this.isStrict && !pattern.isStrict) {
              pattern = pattern.strict
            }
            const error = pattern.catch(value)
            if (error) {
              tyerr.add({ error, key })
            }
          }
          // normal validate
          else {
            const error = this.validate(value, pattern)
            if (error) {
              tyerr.add({ error, key })
            }
          }
        }
      }
    }
    // check prototypes
    else if (Prototype.is(pattern).existing()) {
      const res = Prototype.is(pattern).typeof(value)
      if (res !== true) {
        tyerr.replace({ type: 'exception', value, pattern })
      }
    }
    // check single value
    else if (!Prototype.is(value).equal(pattern)) {
      tyerr.replace({ type: 'exception', value, name: 'equal', pattern })
    }

    tyerr.commit()
    return tyerr.error()
  }

  assert(value) {
    const error = this.catch(value)
    if (error) {
      throw error
    }
  }
  catch(value) {
    const pattern = this.pattern
    const error = this.validate(value, pattern)
    return error
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
        resolve(null)
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
          resolve(null)
        }
      })
    })
  }

  clone() {
    const Constructor = getConstructor(this)
    const ins = new Constructor(this.pattern)
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
