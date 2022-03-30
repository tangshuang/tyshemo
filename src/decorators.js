import { Meta } from './meta.js'
import { isInheritedOf, isInstanceOf, isObject, isArray, clone, isUndefined, fixNum } from 'ts-fns'
import { Model, State } from './model.js'
import { Factory } from './factory.js'
import Ty from './ty/ty.js'
import { onlySupportLegacy } from './shared/utils.js'

const createDecorator = (name, fn, force) => (protos, key, descriptor) => {
  onlySupportLegacy(protos)

  // only works for Model
  if (force && !(protos instanceof Model)) {
    throw new Error(`TySheMo: @${name} only works on class which extends Model.`)
  }

  if (!key) {
    throw new Error(`TySheMo: @${name} only works on a class property.`)
  }

  /**
   * should must decorate properties which has no value
   * class Some extends Model {
   *    @state({ value }) a; // without initializer
   * }
   */
  if (descriptor) {
    const oop = () => {
      throw new Error(`TySheMo: @${name} only works on a class property which has no initializer.`)
    }
    if ('initializer' in descriptor) {
      if (descriptor.initializer) {
        console.log(key, descriptor.initializer())
        oop()
      }
    }
    else {
      oop()
    }
  }
  // if without descriptor -> in typescript

  fn(protos, key)

  // as previous determine, only babel legacy will work here
  // make this property hidden in initialize
  // without a undefined property on the instance
  if (descriptor) {
    return { writable: true, configurable: true };
  }
}

const define = (target, key, value) => {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  })
}

export function meta(entry, options, methods) {
  return createDecorator('meta', (protos, key) => {
    const CurrentModel = protos.constructor

    if (isInheritedOf(entry, Meta) || isInstanceOf(entry, Meta)) {
      define(CurrentModel, key, entry)
    }
    else if (isInheritedOf(entry, Model) || (isArray(entry) && !entry.some(item => !isInheritedOf(item, Model)))) {
      const meta = Factory.getMeta(entry, options, methods)
      define(CurrentModel, key, meta)
    }
    else {
      if (isObject(entry)) {
        const meta = new Meta(entry)
        define(CurrentModel, key, meta)
      }
    }
  }, true)
}

export function state(options) {
  return createDecorator('state', (protos, key) => {
    if (!('value' in options) && !options.get && !options.set) {
      throw new Error(`TySheMo: @state params should not contain either value or get/set.`)
    }
    if ('value' in options && (options.get || options.set)) {
      throw new Error(`TySheMo: @state params should not contain value and get/set together.`)
    }

    const CurrentModel = protos.constructor
    const state = new State(options)
    define(CurrentModel, key, state)
  }, true)
}

export function type(...args) {
  return Ty.decorate.with(...args)
}

export function enhance(source) {
  return createDecorator('enhance', (protos, key) => {
    const CurrentModel = protos.constructor
    define(CurrentModel, key, source)
  })
}
