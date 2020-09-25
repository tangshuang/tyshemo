import {
  isFunction,
  isArray,
  isConstructor,
  isObject,
  createProxy,
  parse,
  assign,
  clone,
  isInstanceOf,
  makeKeyPath,
} from 'ts-fns'

import { createType } from './rules.js'
import Tuple from './tuple.js'

export class Ty {
  constructor() {
    this._listeners = []
    this._silent = false
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
    if (this._translate && error.translate) {
      error.translate(this._translate)
    }

    this.dispatch(error)

    if (!this._silent) {
      throw error
    }
  }
  try(fn, translate) {
    this._translate = translate
    fn()
    this._translate = null
  }

  /**
   * @example
   * ty.expect(10).to.match(Number)
   */
  expect(value) {
    return {
      to: {
        match: (_type) => {
          const type = createType(_type)
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
   * let error = ty.catch(10).by(Number)
   */
  catch(value) {
    return {
      by: (_type) => {
        const type = createType(_type)
        const error = type.catch(value)
        if (error) {
          this.dispatch(error)
        }
        return error
      },
    }
  }

  /**
   * @example
   * ty.trace('10').by(Number)
   */
  trace(value) {
    return {
      by: (_type) => {
        const type = createType(_type)
        return type.trace(value).catch(error => this.throw(error))
      },
    }
  }

  /**
   * @example
   * ty.track('10').by(Number)
   */
  track(value) {
    return {
      by: (_type) => {
        const type = createType(_type)
        return type.track(value).catch(error => this.throw(error))
      },
    }
  }

  /**
   * determine whether type match
   * @example
   * let bool = ty.is(Number).typeof(10)
   * let bool = ty.is(10).of(Number)
   */
  is(arg) {
    return {
      typeof: (value) => {
        const type = createType(arg)
        const error = type.catch(value)
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
   * @ty.decorate('input').with((value) => SomeType.assert(value))
   */
  get decorate() {
    const $this = this
    let source = decorate
    function decorate(what) {
      source = what
      return  { with: decorate.with }
    }
    function wrap(title, target, ...types) {
      const [type, type2] = types
      if (isFunction(target)) {
        const tupl = isInstanceOf(type, Tuple) ? type : new Tuple(type)
        return function(...args) {
          $this.try(() => $this.expect(args).to.be(tupl), `${title} parameters {keyPath} should match {should} but receive {receive}`)
          const result = target.apply(this, args)
          $this.try(() => $this.expect(result).to.be(type2), `${title} returns should match {should} but receive {receive}`)
          return result
        }
      }
      else if (isObject(target)) {
        return createProxy(target, {
          set(keyPath, value) {
            const t = parse(type, keyPath)
            $this.try(() => $this.expect(value).to.be(t), `${makeKeyPath(keyPath)} should match {should} but receive {receive}`)
            return value
          },
        })
      }
      else if (isArray(target)) {
        return createProxy(target, {
          set(keyPath, value) {
            const [index, ...key] = keyPath
            const current = clone(target[index])
            const next = assign(current, key, value)
            const items = Array.from(target, (item, i) => i === index ? next : item)
            $this.try(() => $this.expect(items).to.be(type), `${makeKeyPath(keyPath)} should match {should} but receive {receive}`)
            return value
          },
          push(items) {
            $this.try(() => $this.expect(items).to.be(type), `push items {keyPath} should match {should} but receive {receive}`)
          },
          splice([start, end, ...items]) {
            if (items.length) {
              $this.try(() => $this.expect(items).to.be(type), `splice insert items {keyPath} should match {should} but receive {receive}`)
            }
          },
          fill([value, start, end]) {
            $this.try(() => $this.expect([value]).to.be(type), `fill value should match {should} but receive {receive}`)
          },
        })
      }
      else if (isConstructor(target, 3)) {
        return class extends target {
          constructor(...args) {
            const tupl = isInstanceOf(type, Tuple) ? type : new Tuple(type)
            $this.try(() => $this.expect(args).to.be(tupl), `${target.name} constructor parameters should match {should} but receive {receive}`)
            return super(...args)
          }
        }
      }
      else {
        $this.expect(target).to.be(type)
        return target
      }
    }
    function describe(...types) {
      return (target, prop, descriptor) => {
        const [type] = types
        // decorate class constructor
        if (target && !prop) {
          return wrap(`${target.constructor.name}.constructor`, target, ...types)
        }
        // decorate class member
        else if (target && prop) {
          // computed property with setter
          if (descriptor.set || descriptor.get) {
            const [input, output] = types
            const get = descriptor.get ? (!input.length ? wrap(`${target.constructor.name}.${prop} getter`, descriptor.get, [], output) : descriptor.get) : void 0
            const set = descriptor.set ? (!output ? wrap(`${target.constructor.name}.${prop} setter`, descriptor.set, input) : descriptor.set) : void 0
            return {
              ...descriptor,
              set,
              get,
            }
          }
          // function method
          else if (descriptor.writable && isFunction(descriptor.value)) {
            return {
              ...descriptor,
              value: wrap(`${target.constructor.name}.${prop}`,descriptor.value, ...types),
            }
          }
          else if (descriptor.writable && descriptor.initializer) {
            let value = descriptor.initializer()
            $this.try(() => $this.expect(value).to.be(type), `${target.name}.${prop} should be {should} but receive {receive}`)
            return {
              enumerable: descriptor.enumerable,
              configurable: descriptor.configurable,
              set: (v) => {
                $this.try(() => $this.expect(v).to.be(type), `${target.name}.${prop} should be {should} but receive {receive}`)
                value = v
              },
              get: () => value
            }
          }
          // normal property
          else if (descriptor.writable) {
            let value = descriptor.value
            return {
              enumerable: descriptor.enumerable,
              configurable: descriptor.configurable,
              set: (v) => {
                $this.try(() => $this.expect(v).to.be(type), `${target.name}.${prop} should be {should} but receive {receive}`)
                value = v
              },
              get: () => value
            }
          }
          else {
            return descriptor
          }
        }
        else {
          return descriptor
        }
      }
    }
    decorate.with = (...types) => {
      if (source !== decorate) {
        return wrap(`function ${source.name}`,source, ...types)
      }
      else {
        return describe(...types)
      }
    }
    return decorate
  }
}

const ty = new Ty()

Ty.expect = ty.expect.bind(ty)
Ty.catch = ty.catch.bind(ty)
Ty.trace = ty.trace.bind(ty)
Ty.track = ty.track.bind(ty)
Ty.is = ty.is.bind(ty)
Ty.create = createType

Object.defineProperty(Ty, 'decorate', { get: () => ty.decorate })

export default Ty
