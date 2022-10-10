import {
  isInheritedOf,
  isArray,
} from 'ts-fns'
import { Meta, AsyncMeta, SceneMeta, StateMeta } from './meta.js'
import { Model } from './model.js'
import { Factory } from './factory.js'

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

/**
 *
 * @param {*} defaultAttrs
 * @param {*} asyncGetter not supports `default, activate, init, state, compute, AsyncGetter`
 * @returns
 */
export function createAsyncMeta(defaultAttrs, asyncGetter) {
  class ThisAsyncMeta extends AsyncMeta {
    fetchAsyncAttrs() {
      return asyncGetter().then((data) => ({
        ...data,
      }))
    }
  }
  Object.assign(ThisAsyncMeta, defaultAttrs)
  return new ThisAsyncMeta()
}

export function createSceneMeta(defaultAttrs, sceneMapping) {
  class ThisSceneMeta extends SceneMeta {
    defineScenes() {
      return sceneMapping
    }
  }
  Object.assign(ThisSceneMeta, defaultAttrs)
  return ThisSceneMeta
}

export function createStateMeta(options) {
  return new StateMeta(options)
}
