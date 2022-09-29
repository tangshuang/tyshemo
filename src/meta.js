import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inObject,
  isArray,
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

function useAttr(meta, key, descriptor) {
  const { value } = descriptor
  if (key === 'validators') {
    meta.validators = isArray(value) ? createValidators(value) : []
    return
  }
  meta[key] = value
}

function useAttrs(meta, attrs) {
  each(attrs, (descriptor, key) => {
    useAttr(meta, key, descriptor)
  }, true)
}

export class Meta {
  constructor(attrs = {}) {
    // from inherit chain
    const properties = ofChain(this, Meta)
    each(properties, (descriptor, key) => {
      if (inObject(key, attrs, true)) {
        return
      }
      useAttr(this, key, descriptor)
    }, true)

    // from prototype
    const Constructor = getConstructorOf(this)
    const { prototype } = Constructor
    each(prototype, (descriptor, key) => {
      if (['constructor', 'extend', 'fetchAsyncAttrs'].includes(key)) {
        return
      }
      if (inObject(key, this)) {
        return
      }
      useAttr(this, key, descriptor)
    }, true)

    // from attrs
    useAttrs(this, attrs)
  }

  extend(attrs) {
    const Constructor = getConstructorOf(this)
    const meta = new Constructor(this)
    Object.setPrototypeOf(meta, this) // make it impossible to use meta
    useAttrs(meta, attrs)
    return meta
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

const AsyncMetaReadyKey = Symbol()
export class AsyncMeta extends Meta {
  constructor(attrs = {}) {
    super()
    const Constructor = getConstructorOf(this)
    let ready = Object.getOwnPropertyDescriptor(Constructor, AsyncMetaReadyKey)?.value
    if (!ready) {
      ready = Constructor[AsyncMetaReadyKey] = {
        attrs: null,
        notifiers: [],
      }
    }
    if (!ready.attrs) {
      this.fetchAsyncAttrs().then((data) => {
        useAttrs(this, data)
        useAttrs(this, attrs)
        ready.attrs = data
        ready.notifiers.forEach(({ model, key }) => {
          model.$store.forceDispatch(`!${key}`, 'async meta')
        })
        ready.notifiers.length = 0
      })
    }
    else {
      useAttrs(this, ready.attrs)
      useAttrs(this, attrs)
    }
  }
  fetchAsyncAttrs() {
    return Promise.resolve({})
  }
  _awaitMeta(model, key) {
    const Constructor = getConstructorOf(this)
    let ready = Object.getOwnPropertyDescriptor(Constructor, AsyncMetaReadyKey)?.value
    if (!ready) {
      ready = Constructor[AsyncMetaReadyKey] = {
        attrs: null,
        notifiers: [],
      }
    }
    if (!ready.attrs) {
      ready.notifiers.push({ model, key })
    }
  }
}
