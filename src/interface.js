import {
  isInheritedOf,
  isArray,
  getConstructorOf,
} from 'ts-fns'
import { Meta, AsyncMeta, SceneMeta, StateMeta, SceneStateMeta } from './meta.js'
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
 * const [Meta1, Meta2, Meta3] = createMetaRef((Meta1, Meta2, Meta3) => {
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
export function createMetaRef(create) {
  const count = create.length
  const items = create() // prepare

  if (!isArray(items) || items.length !== count) {
    throw new Error('[TySheMo]: createMetaRef should get an array with same length as count.')
  }

  const metaClasses = items.map((item) => getConstructorOf(item))
  const metas = metaClasses.map(M => new M())
  const results = create(...metas)

  const output = results.map((item, i) => {
    const meta = metas[i]
    return Object.setPrototypeOf(item, meta)
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
  return new ThisSceneMeta()
}

export function createStateMeta(attrs) {
  return new StateMeta(attrs)
}

export function createSceneStateMeta(defaultAttrs, sceneMapping) {
  class ThisSceneStateMeta extends SceneStateMeta {
    defineScenes() {
      return sceneMapping
    }
  }
  Object.assign(ThisSceneStateMeta, defaultAttrs)
  return new ThisSceneStateMeta()
}
