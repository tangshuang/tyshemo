import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inObject,
  isArray,
  define,
  each,
  isEmpty,
} from 'ts-fns'
import { Validator } from './validator.js'
import { ofChain } from './shared/utils.js'

const createValidators = (items) => {
  return items.map(v =>
    isInstanceOf(v, Validator) ? v
      : isInheritedOf(v, Validator) ? new v()
        : v && typeof v === 'object' && !isEmpty(v) ? new Validator(v)
          : null
  ).filter(v => !!v)
}

function useAttr(meta, key, descriptor, context) {
  const { value, get, set } = descriptor

  if (key === 'validators') {
    const items = value ? value : get ? get.call(context) : null
    meta.validators = isArray(items) ? createValidators(items) : []
    return
  }

  if (get || set) {
    define(meta, key, {
      get,
      set,
      enumerable: true,
      configurable: true,
    })
  }
  else {
    meta[key] = value
  }
}

export class Meta {
  constructor(attrs = {}) {
    // from inherit chain
    const properties = ofChain(this, Meta)
    each(properties, (descriptor, key) => {
      if (inObject(key, attrs, true)) {
        return
      }
      useAttr(this, key, descriptor, properties)
    }, true)

    // from prototype
    const Constructor = getConstructorOf(this)
    const { prototype } = Constructor
    each(prototype, (descriptor, key) => {
      if (key === 'extend' || key === 'constructor' || key === 'getAttr' || key === 'setAttr') {
        return
      }
      if (inObject(key, this)) {
        return
      }
      useAttr(this, key, descriptor, this)
    }, true)

    // from attrs
    each(attrs, (descriptor, key) => {
      useAttr(this, key, descriptor, attrs)
    }, true)
  }

  extend(attrs) {
    const Constructor = getConstructorOf(this)
    const meta = new Constructor(this)
    Object.setPrototypeOf(meta, this) // make it impossible to use meta
    each(attrs, (descriptor, key) => {
      useAttr(meta, key, descriptor, attrs)
    }, true)
    return meta
  }

  getAttr(attr) {
    return this[attr]
  }

  setAttr(attr, value) {
    this[attr] = value
  }

  static extend(attrs) {
    const Constructor = inherit(this, null, attrs)
    return Constructor
  }

  static create(attrs) {
    const Constructor = inherit(Meta, null, attrs)
    return Constructor
  }
}
