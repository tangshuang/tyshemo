import { Meta } from './meta.js'
import { isInheritedOf, isInstanceOf, isObject, isArray, clone } from 'ts-fns'
import { Model } from './model.js'
import { Factory } from './factory.js'
import Ty from './ty/ty.js'

export function meta(entry, options, methods) {
  return (protos, prop, descriptor) => {
    const isTs = protos && protos[Symbol.toStringTag] === 'Descriptor'
    if (!isTs) {
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
    // typescript
    else {
      if (descriptor) {
        throw new Error(`[TySheMo]: @meta only works for a Model class property.`)
      }

      protos.__metas = protos.__metas || []
      protos.__metas.push({
        key,
        entry,
        options,
        methods,
      })

      protos.schema = protos.schema || function() {
        const metas = protos.__metas
        const schema = {}
        metas.forEach(({ key, entry, options, methods }) => {
          const defaultValue = this[key]

          if (isInheritedOf(entry, Meta) || isInstanceOf(entry, Meta)) {
            schema[key] = entry
          }
          else if (isInheritedOf(entry, Model) || (isArray(entry) && !entry.some(item => !isInheritedOf(item, Model)))) {
            const attrs = {
              default: clone(defaultValue),
              ...(options || {}),
            }
            const meta = Factory.getMeta(entry, attrs, methods)
            schema[key] = meta
          }
          else {
            const attrs = {
              default: clone(defaultValue),
            }

            if (entry && isObject(entry)) { // may be null
              Object.assign(attrs, entry)
            }

            schema[prop] = new Meta(attrs)
          }
        })
        // remove the helper property
        delete protos.__metas
        return schema
      }
    }
  }
}

export function state() {
  return (protos, prop, descriptor) => {
    const isTs = protos && protos[Symbol.toStringTag] === 'Descriptor'
    if (!isTs) {
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
    // typescript
    else {
      if (descriptor) {
        throw new Error(`[TySheMo]: @state only works for a Model class property.`)
      }

      protos.__states = protos.__states || []
      protos.__states.push({ key, attrs })

      protos.state = protos.state || function() {
        const states = protos.__states
        const state = {}
        states.forEach(({ key, attrs }) => {
          if (attrs) {
            Object.defineProperty(state, key, attrs)
          }
          else {
            state[key] = this[key]
          }
        })
        // remove the helper property
        delete protos.__states
        return state
      }
    }
  }
}

export function type(...args) {
  return Ty.decorate.with(...args)
}
