import { Meta } from './meta.js'
import { isInheritedOf, isInstanceOf, isObject, isArray } from 'ts-fns'
import { Model } from './model.js'
import { Factory } from './factory.js'

export function meta(entry, options, methods) {
  return (protos, prop, descriptor) => {
    const { initializer } = descriptor

    if (isInheritedOf(entry, Meta) || isInstanceOf(entry, Meta)) {
      const schema = protos.schema()
      schema[prop] = entry
      protos.schema = () => schema
    }
    else if (isInheritedOf(entry, Model) || (isArray(entry) && !entry.some(item => !isInheritedOf(item, Model)))) {
      const attrs = {
        default: initializer,
        ...(options || {}),
      }
      const meta = Factory.getMeta(entry, attrs, methods)
      const schema = protos.schema()
      schema[prop] = meta
      protos.schema = () => schema
    }
    else {
      const attrs = {
        default: initializer,
      }

      if (entry && isObject(entry)) { // may be null
        Object.assign(attrs, entry)
      }

      const schema = protos.schema()
      schema[prop] = new Meta(attrs)
      protos.schema = () => schema
    }

    // return an empty object to not redefine the property
    return {}
  }
}

export function state() {
  return (protos, prop, descriptor) => {
    const { initializer, ...others } = descriptor
    const state = protos.state()
    const desc = {
      ...others,
      configurable: true,
    }
    if (initializer) {
      desc.value = initializer()
      desc.writable = true
    }
    Object.defineProperty(state, prop, desc)
    protos.state = () => state

    return desc
  }
}
