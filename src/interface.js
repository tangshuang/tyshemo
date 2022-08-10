import {
  isInheritedOf,
  isArray,
  each,
} from 'ts-fns'
import { Meta } from './meta.js'
import { Model } from './model.js'
import { Factory } from './factory.js'
import { createScope } from 'scopex'
import { parseKey, isInlineExp, getExp, createFn, tryGetRealValue } from './loader.js'

export function createMeta(...args) {
  const [entries] = args
  if (isArray(entries) && !entries.some(entry => !isInheritedOf(entry, Model))) {
    return Factory.createMeta(...args)
  }
  if (isInheritedOf(entries, Model)) {
    return Factory.createMeta(...args)
  }
  return new Meta(entries)
}

/**
 * if several metas referer to each other, we should create them as a group
 * @param {number} count
 * @param {function} create return objects to generate metas
 * @returns {Meta[]}
 * @example
 * const [Meta1, Meta2, Meta3] = createMetaGroup(3, (Meta1, Meta2, Meta3) => {
 *   return [
 *     // for Meta1
 *     createMeta({
 *       default: 0,
 *       needs() {
 *         return [Meta1, Meta2, Meta3]
 *       },
 *     }),
 *     // for Meta2
 *     createMeta({
 *       default: 1,
 *       needs() {
 *         return [Meta1, Meta2, Meta3]
 *       },
 *     }),
 *     // for Meta3
 *     createMeta({
 *       default: 2,
 *       needs() {
 *         return [Meta1, Meta2, Meta3]
 *       },
 *     }),
 *   ]
 * })
 */
export function createMetaGroup(count, create) {
  const metas = []
  for (let i = 0; i < count; i ++) {
    metas.push(class extends Meta {})
  }

  const items = create(...metas)

  if (!isArray(items) || items.length !== count) {
    throw new Error('[TySheMo]: createMetaGroup should get an array with same length as count.')
  }

  const output = items.map((item, i) => {
    const Meta = metas[i]
    return new Meta(item)
  })

  return output
}

export class AsyncMeta extends Meta {
  constructor(...args) {
    super(...args)
    this.fetchAsyncAttrs()
  }
  fetchAsyncAttrs() {}
  onInitAsyncMeta() {}
}

/**
 *
 * @param {*} defaultAttrs
 * @param {*} asyncGetter not supports `default, activate, init, state, compute, AsyncGetter`
 * @returns
 */
export function createAsyncMeta(defaultAttrs, asyncGetter) {
  let asyncAttrs = null

  const scope = createScope({})
  const parseAttrs = (data) => {
    const attrs = {}
    each(data, (value, key) => {
      const [name, params] = parseKey(key)
      const isStr = typeof value === 'string'

      if (params) {
        const getter = function(...args) {
          if (!isStr) {
            return value
          }
          const exp = getExp(value)
          const localScope = scope.$new(this)
          const fn = createFn(localScope, exp, params)
          return fn(...args)
        }
        attrs[name] = getter
      }
      else if (isInlineExp(value)) {
        const getter = function(...args) {
          if (!isStr) {
            return value
          }
          const exp = getExp(value)
          const localScope = scope.$new(this)
          const fn = createFn(localScope, exp, [])
          return fn(...args)
        }
        attrs[name] = getter
      }
      else {
        attrs[name] = isStr ? tryGetRealValue(value) : value
      }
    })
    return attrs
  }

  let waiters = []
  let deferer = Promise.resolve(asyncGetter()).then((data) => {
    const attrs = parseAttrs(data)
    asyncAttrs = attrs
    return attrs
  })
  const notify = () => {
    waiters.forEach(({ model, key }) => {
      model.$store.forceDispatch(`!${key}`, 'async meta')
    })
    waiters.length = 0
  }

  class ThisAsyncMeta extends AsyncMeta {
    fetchAsyncAttrs() {
      if (!asyncAttrs) {
        deferer.then((attrs) => {
          Object.assign(this, attrs)
          notify()
        })
      }
      else {
        Object.assign(this, asyncAttrs)
      }
    }
    onInitAsyncMeta(model, key) {
      if (!asyncAttrs) {
        waiters.push({ model, key })
      }
    }
  }

  Object.assign(ThisAsyncMeta, defaultAttrs)
  return ThisAsyncMeta
}
