import { isFunction } from './utils.js'
import Dict from './types/dict.js'
import List from './types/list.js'
import Type from './type.js'

export class Ty {
  constructor() {
    this._listeners = []
    this._silent = false
  }

  make(type, strict) {
    if (isObject(type)) {
      type = new Dict(type)
    }
    if (isArray(type)) {
      type = new List(type)
    }
    if (!isInstanceOf(type, Type)) {
      type = new Type(type)
    }

    if (arguments.length > 1) {
      type = type.clone().toBeStrict(strict)
    }

    return type
  }

  bind(fn) {
    if (isFunction(fn)) {
      this._listeners.push(fn)
    }
    return this
  }
  unbind(fn) {
    this._listeners.forEach((item, i) => {
      if (item === fn) {
        this._listeners.splice(i, 1)
      }
    })
    return this
  }
  dispatch(error) {
    this._listeners.forEach((fn) => {
      Promise.resolve().then(() => fn.call(this, error))
    })
    return this
  }

  silent(value) {
    this._silent = !!value
  }
  throw(error) {
    this.dispatch(error)

    if (!this._silent) {
      throw error
    }
  }

  /**
   * @example
   * ts.expect(10).to.match(Number)
   */
  expect(value) {
    return {
      to: {
        match: (type) => {
          type = makeType(type)

          try {
            type.assert(value)
            return true
          }
          catch (e) {
            this.throw(e)
            return false
          }
        },
        be: (type) => {
          return this.expect(value).to.match(type)
        },
      },
    }
  }

  /**
   * @example
   * let error = ts.catch(10).by(Number)
   */
  catch(value) {
    return {
      by: (type) => {
        type = makeType(type)

        let error = type.catch(value)
        if (error) {
          this.dispatch(error)
        }
        return error
      },
    }
  }

  /**
   * @example
   * ts.trace('10').by(Number)
   */
  trace(value) {
    return {
      by: (type) => {
        type = makeType(type)

        return type.trace(value).catch(error => this.throw(error))
      },
    }
  }

  /**
   * @example
   * ts.track('10').by(Number)
   */
  track(value) {
    return {
      by: (type) => {
        type = makeType(type)

        return type.track(value).catch(error => this.throw(error))
      },
    }
  }

  /**
   * determine whether type match
   * @example
   * let bool = ts.is(Number).typeof(10)
   * let bool = ts.is(10).of(Number)
   */
  is(arg) {
    return {
      typeof: (value) => {
        let type = arg
        type = makeType(type)

        let error = type.catch(value)
        if (error) {
          this.dispatch(error)
        }
        return !error
      },
      of: (type) => this.is(type).typeof(arg),
    }
  }

  /**
   * @param {string|undefined} which input|output
   * @example
   * @ts.decorate('input').with((value) => SomeType.assert(value))
   */
  decorate(what) {
    return {
      with: (type) => (target, prop, descriptor) => {
        // decorate class constructor function
        if (target && !prop) {
          if (what !== 'input' && what !== 'output') {
            return class extends target {
              constructor(...args) {
                this.expect(args).to.be(type)
                super(...args)
              }
            }
          }
          else {
            return target
          }
        }
        // decorate class member
        else if (prop) {
          // change the property
          if (what !== 'input' && what !== 'output') {
            descriptor.set = (value) => {
              this.expect(value).to.be(type)
              descriptor.value = value
            }
          }

          // what
          if (typeof property === 'function' && (what === 'input' || what === 'output')) {
            let property = descriptor.value
            let $this = this
            let wrapper = function(...args) {
              if (what === 'input') {
                $this.expect(args).to.be(type)
              }
              let result = property.call(this, ...args)
              if (what === 'output') {
                $this.expect(result).to.be(type)
              }
              return result
            }
            descriptor.value = wrapper
          }

          return descriptor
        }
        else {
          return descriptor
        }
      }
    }
  }

}

export const ts = new Ty()
Ty.expect = ts.expect.bind(ts)
Ty.catch = ts.catch.bind(ts)
Ty.trace = ts.trace.bind(ts)
Ty.track = ts.track.bind(ts)
Ty.is = ts.is.bind(ts)
Ty.decorate = ts.decorate.bind(ts)
Ty.make = ts.make.bind(ts)

export default Ty
