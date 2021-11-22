import {
  isArray,
  isObject,
  isInstanceOf,
  inArray,
  inObject,
  getConstructorOf,
  isUndefined,
  isString,
  decideby,
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
    this.isLoose = false
    this.pattern = pattern
    this.name = 'Type'
    this.$msg = null
  }

  /**
   * validate whether the argument match the pattern
   * @param {*} value
   * @param {*} pattern
   */
  validate(...args) {
    const [value, pattern] = decideby(() => {
      if (args.length === 1) {
        return [args[0], this.pattern]
      }
      else {
        return args
      }
    })

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
              else if (!this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose) {
                pattern = pattern.loose
              }

              const error = pattern.catch(value)
              if (!error) {
                return []
              }
              else {
                errors.push(error)
              }
            }
            // normal validate
            else {
              const error = this.validate(value, pattern)
              if (!error) {
                return []
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
          if (errors.length) {
            tyerr.add({
              type: 'notin',
              value,
              name: this.name,
              pattern,
              errors,
              index: i,
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

          // skip in loose mode when has no property
          if (!this.isStrict && this.isLoose && !Object.prototype.hasOwnProperty.call(data, key)) {
            continue
          }

          const value = data[key]

          let pattern = patterns[key]

          const isRule = isInstanceOf(pattern, Rule)
          if (isRule) {
            const rule = this.isStrict && !pattern.isStrict ? pattern.strict
              : !this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose ? pattern.loose
              : pattern
            const error = rule.catch(data, key)
            if (!error) {
              continue
            }

            // after validate, the property may create by rule
            if (!inObject(key, data)) {
              tyerr.add({
                type: 'missing',
                key,
                value,
                pattern,
              })
            }
            else {
              tyerr.add({ error, key })
            }
          }
          // not found some key in data
          // i.e. should be { name: String, age: Number } but give { name: 'tomy' }, 'age' is missing
          else if (!inObject(key, data)) {
            tyerr.add({
              type: 'missing',
              key,
              value,
              pattern,
            })
          }
          // nested Type
          else if (isInstanceOf(pattern, Type)) {
            if (this.isStrict && !pattern.isStrict) {
              pattern = pattern.strict
            }
            else if (!this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose) {
              pattern = pattern.loose
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
    // fix: new Mapping({ key: String, value: new Dict(...) })
    else if (isInstanceOf(pattern, Type)) {
      if (this.isStrict && !pattern.isStrict) {
        pattern = pattern.strict
      }
      else if (!this.isStrict && this.isLoose && !pattern.isStrict && pattern.isLoose) {
        pattern = pattern.loose
      }

      const error = pattern.catch(value)
      if (error) {
        tyerr.add({ error, value, name: pattern.name, pattern })
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
    else if (!Prototype.is(pattern).equal(value)) {
      tyerr.replace({ type: 'exception', value, name: 'equal', pattern })
    }

    tyerr.commit()
    return tyerr.error()
  }

  _decide(value) {
    const pattern = this.pattern
    const error = this.validate(value, pattern)
    return error
  }

  catch(value) {
    const error = this._decide(value)
    if (error && this.$msg) {
      error.translate(this.$msg.message, this.$msg.prefix, this.$msg.suffix)
    }
    return error
  }

  assert(value) {
    const error = this.catch(value)
    if (error) {
      throw error
    }
  }

  test(value) {
    const error = this.catch(value)
    return !error
  }

  /**
   * track value with type sync
   * @param {*} value
   */
  track(value) {
    return new Promise((resolve, reject) => {
      const error = this.catch(value)
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
        const error = this.catch(value)
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
    const Constructor = getConstructorOf(this)
    const ins = new Constructor(this.pattern)
    ins.isStrict = this.isStrict
    ins.isLoose = this.isStrict ? false : this.isLoose
    ins.name = this.name
    ins.$msg = this.$msg
    return ins
  }

  toBeStrict(mode = true) {
    this.isStrict = !!mode
    if (mode) {
      this.isLoose = false
    }
    return this
  }

  get strict() {
    const ins = this.clone().toBeStrict()
    return ins
  }
  get Strict() {
    return this.strict
  }

  toBeLoose(mode = true) {
    if (this.isStrict) {
      console.error('TySheMo: strict Type can not change to be loose.')
      return this
    }

    this.isLoose = !!mode
    return this
  }

  get loose() {
    const ins = this.clone().toBeLoose()
    return ins
  }

  get Loose() {
    return this.loose
  }

  with({ name, strict, message, prefix, suffix }) {
    this.$msg = message || prefix || suffix ? Object.assign({}, { message, prefix, suffix }) : null
    if (isString(name)) {
      this.name = name
    }
    if (!isUndefined(strict)) {
      this.isStrict = !!strict
    }
    return this
  }

  // use name when convert to string
  toString() {
    return this.name
  }

}

export default Type
