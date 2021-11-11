import { Meta } from './meta.js'
import { isInheritedOf, isInstanceOf, isObject } from 'ts-fns'
import { Model } from './model.js'

export function meta(meta) {
  return (model, prop, descriptor) => {
    if (isInheritedOf(meta, Meta) || isInstanceOf(meta, Meta)) {
      const schema = model.schema()
      schema[prop] = meta
      model.schema = () => schema
    }
    else {
      const { initializer } = descriptor
      const attrs = {
        default: initializer,
      }
      if (isObject(meta)) {
        Object.assign(attrs, meta)
      }
      const schema = model.schema()
      schema[prop] = new Meta(attrs)
      model.schema = () => schema
    }

    // return an empty object to not redefine the property
    return {}
  }
}

export function state() {
  return (model, prop, descriptor) => {
    const { initializer, ...others } = descriptor
    const state = model.state()
    const desc = {
      ...others,
    }
    if (initializer) {
      desc.value = initializer()
    }
    Object.defineProperty(state, prop, desc)
    model.state = () => state
  }
}
