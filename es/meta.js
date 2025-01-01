import {
  getConstructorOf,
  inherit,
  isInstanceOf,
  isInheritedOf,
  inObject,
  isArray,
  each,
  isEmpty,
  filter,
  isUndefined,
  isFunction,
  define,
  isObject,
} from 'ts-fns'
import { Validator } from './validator.js'
import { ofChain } from './shared/utils.js'
import { RESERVED_ATTRIBUTES } from './shared/configs.js'
import { ComputeSymbol } from './shared/constants.js'

const AsyncMetaSymbol = Symbol()
const SceneMetaSymbol = Symbol()

const createValidator = v =>
  isInstanceOf(v, Validator) ? v
    : isInheritedOf(v, Validator) ? new v()
      : v && typeof v === 'object' && !isEmpty(v) ? new Validator(v)
        : null

const createValidators = (items) => {
  if (isArray(items)) {
    return items.map(createValidator).filter(Boolean)
  }
  if (isObject(items)) {
    const validators = []
    const keys = Object.keys(items)
    keys.forEach((key) => {
      const item = items[key]
      const validator = createValidator(item)
      if (validator) {
        const index = validators.length
        validators[key] = index // patch key on the array
        validators.push(validator)
      }
    })
    return validators
  }
}

const mergeValidators = (meta, newValdiators) => {
  const originValidators = isObject(meta.validators) ? createValidators(meta.validators)
    : meta.validators || []
  // concat array
  if (isArray(newValdiators)) {
    return [...originValidators, ...newValdiators.map(createValidator).filter(Boolean)]
  }
  // merge mapping
  if (isObject(newValdiators)) {
    const validators = []
    Object.assign(validators, originValidators) // originValidators may have keys more than indexes
    const keys = Object.keys(newValdiators)
    keys.forEach((key) => {
      const item = newValdiators[key]
      const validator = createValidator(item)
      const keyIndex = originValidators[key]
      // add or replace validator
      if (validator) {
        // replace
        if (!isUndefined(keyIndex)) {
          validators[keyIndex] = validator
        }
        // add
        else {
          const index = validators.length
          validators[key] = index // patch key on the array
          validators.push(validator)
        }
      }
      // remove the previous validator
      else {
        if (!isUndefined(keyIndex)) {
          validators[keyIndex] = null
        }
      }
    })
    return validators.filter(Boolean)
  }
  // no change
  return originValidators
}

function useAttr(meta, key, descriptor) {
  if (key === 'validators') {
    const { value } = descriptor
    meta.validators = createValidators(value)
    return
  }
  define(meta, key, descriptor)
}

const ensureAttrs = (attrs) => {
  if (!attrs || typeof attrs !== 'object') {
    return {}
  }
  return filter(attrs, (value) => {
    if (isUndefined(value)) {
      return false
    }
    return true
  })
}

const notifyAttrs = (notifiers, attrs, message) => {
  const viewGetters = {}
  const viewAttrs = {}
  each(attrs, (value, key) => {
    if (isUndefined(value)) {
      return
    }
    if (inObject(key, RESERVED_ATTRIBUTES)) {
      return
    }
    if (isFunction(value)) {
      viewGetters[key] = value
    }
    else {
      viewAttrs[key] = value
    }
  })
  notifiers.forEach(({ model, key }) => {
    if (!model.$inited) {
      return
    }
    model.use(key, (view) => {
      model.$store.runSilent(() => {
        Object.assign(view, viewAttrs)
      })
      each(viewGetters, (getter, attr) => {
        define(view, attr, {
          get: () => {
            const data = model.getData(key)
            return getter.call(model, data, key)
          },
          enumerable: true,
          configurable: true,
        })
      })
      model.$store.forceDispatch(`!${key}`, message)
    })
  })
}

export class Meta {
  constructor(attrs = {}) {
    const descriptors = {}

    // from inherit chain
    const properties = ofChain(this, Meta, ['Scene'])
    each(properties, (descriptor, key) => {
      if (inObject(key, attrs, true)) {
        return
      }
      descriptors[key] = properties[key]
    }, true)

    // from prototype
    const Constructor = getConstructorOf(this)
    const { prototype } = Constructor
    each(prototype, (descriptor, key) => {
      if (key[0] === '_') {
        return
      }
      if (['constructor', 'extend', 'fetchAsyncAttrs', 'defineScenes', 'switchScene', 'Scene'].includes(key)) {
        return
      }
      if (inObject(key, attrs, true)) {
        return
      }
      if (inObject(key, descriptors)) {
        return
      }
      descriptors[key] = prototype[key]
    }, true)

    this.__init(descriptors, attrs)
  }

  __init(descriptors, attrs) {
    this.__useAttrs(descriptors, attrs)
  }

  __useAttrs(...attrsets) {
    const attrs = attrsets.length > 1 ? attrsets.reduce((attrs, item) => {
      Object.assign(attrs, item)
      return attrs
    }, {}) : attrsets[0]
    each(attrs, (descriptor, key) => {
      useAttr(this, key, descriptor)
    }, true)
  }

  __restoreAttrs(allAttrs) {
    const attrs = { ...allAttrs }
    if (this[ComputeSymbol] && attrs.compute) {
      this[ComputeSymbol] = attrs.compute
      delete attrs.compute
    }

    this.__useAttrs(attrs)
    each(this, (_, key) => {
      if (!(key in attrs)) {
        delete this[key]
      }
    })
  }

  extend(attrs = {}) {
    const Constructor = getConstructorOf(this)
    class NewMeta extends Constructor {}

    let defaultAttrs = { ...this }
    if (this[AsyncMetaSymbol]) {
      defaultAttrs = this[AsyncMetaSymbol].default
    }
    else if (this[SceneMetaSymbol]) {
      defaultAttrs = this[SceneMetaSymbol].default
    }

    const attrset = { ...defaultAttrs, ...attrs }
    if (attrs.validators) {
      attrset.validators = mergeValidators(this, attrs.validators)
    }

    // pass attrs so that it will be used as passed attrs in scene meta
    const meta = new NewMeta(attrset)

    Object.setPrototypeOf(meta, this) // make it impossible to use meta

    return meta
  }

  static extend(attrs) {
    if (attrs?.validators) {
      const validators = mergeValidators(this, attrs && attrs.validators)
      const Constructor = inherit(this, null, { ...attrs, validators })
      return Constructor
    }
    const Constructor = inherit(this, null, attrs)
    return Constructor
  }
}

export class AsyncMeta extends Meta {
  __init(descriptors, attrs) {
    super.__init(descriptors, attrs)
    this[AsyncMetaSymbol] = {
      descriptors,
      default: attrs,
      notifiers: [],
      // -1 not begin fetching
      // 0 fetching
      // 1 fetched
      status: -1,
    }
  }
  fetchAsyncAttrs() {
    return Promise.resolve({})
  }
  _awaitMeta(model, key) {
    const { descriptors, default: attrs, notifiers, status } = this[AsyncMetaSymbol]

    if (status === 1) {
      return
    }

    if (status === 0) {
      notifiers.push({ model, key })
      return
    }

    this[AsyncMetaSymbol].status = 0
    this.fetchAsyncAttrs().then((data) => {
      const next = ensureAttrs({
        ...descriptors,
        ...attrs,
        ...data,
      })
      this.__restoreAttrs(next)
      notifyAttrs(notifiers, next, 'async meta')
      notifiers.length = 0
      this[AsyncMetaSymbol].status = 1
    })
  }
}

export class SceneMeta extends Meta {
  __init(descriptors, attrs) {
    super.__init(descriptors, attrs)
    this[SceneMetaSymbol] = {
      descriptors,
      default: attrs,
      notifiers: [],
      codes: [],
    }
    this._initSceneCode()
  }
  _ensureAttrs(attrs) {
    return ensureAttrs(attrs)
  }
  defineScenes() {
    return {}
  }
  switchScene(sceneCode) {
    const { descriptors, default: defaultAttrs, notifiers } = this[SceneMetaSymbol]

    const sceneCodes = isArray(sceneCode) ? sceneCode : [sceneCode]
    const scenes = this.defineScenes()

    const use = (sceneCode) => {
      const scene = scenes[sceneCode]
      if (scene && typeof scene === 'function') {
        const res = scene()
        return res
      }
      else if (scene) {
        return scene
      }
      // do nothing if not exist
      // else {
      //   return Promise.reject(new Error(`[TySheMo]: Scene ${sceneCode} is not defined on Meta ${JSON.stringify(this)}`))
      // }
    }

    const restore = (scenes) => {
      const attrs = {}
      scenes.forEach((scene) => {
        Object.assign(attrs, this._ensureAttrs(scene))
      })
      const next = this._ensureAttrs({
        ...descriptors,
        ...defaultAttrs,
        ...attrs,
      })
      this.__restoreAttrs(next)
      return next
    }

    const finish = () => {
      notifiers.length = 0
    }

    const results = []
    sceneCodes.forEach((code) => {
      const scene = use(code)
      if (!scene) {
        return
      }
      results.push(scene)
    })
    this[SceneMetaSymbol].codes = sceneCodes

    // set new attributes
    if (results.some(item => item instanceof Promise)) {
      // restore some scenes before async
      const preloadScenes = results.filter(item => !(item instanceof Promise))
      if (preloadScenes.length) {
        const preloadAttrs = restore(preloadScenes)
        notifyAttrs(notifiers, preloadAttrs, 'scene meta')
        // dont finish it
      }

      return Promise.all(results.map(item => item instanceof Promise ? item : Promise.resolve(item)))
        .then((scenes) => {
          return restore(scenes)
        })
        .then((attrs) => {
          notifyAttrs(notifiers, attrs, 'scene meta')
        })
        .finally(() => {
          finish()
        })
    }
    else if (results.length) {
      const attrs = restore(results)
      notifyAttrs(notifiers, attrs, 'scene meta')
      finish()
    }
    else {
      finish()
    }
  }
  _awaitMeta(model, key) {
    const { notifiers } = this[SceneMetaSymbol]
    notifiers.push({ model, key })
  }
  _initSceneCode() {}
}

/**
 * special meta which treated as state, the following attributes not working: default, drop, to, map, state
 * should must pass `value`
 */
export class StateMeta extends Meta {
  __init(descriptors, attrs) {
    const { value, default: defaultValue = value, ...others } = attrs
    delete others.drop
    delete others.state

    const desc = { ...descriptors }
    delete desc.drop
    delete desc.state
    desc.default = isUndefined(defaultValue) ? descriptors.value : defaultValue

    super.__init(desc, others)
    // force make drop true, can not be changed
    define(this, 'drop', { value: true, writable: false, enumerable: true, configurable: false })
  }
}

export class SceneStateMeta extends SceneMeta {
  __init(descriptors, attrs) {
    super.__init(descriptors, attrs)
    StateMeta.prototype.__init.call(this, descriptors, attrs)
  }
  _ensureAttrs(attrs) {
    const { value, ...others } = attrs

    delete others.drop
    delete others.state
    delete others.default

    if (!isUndefined(value)) {
      others.default = value
    }

    return super._ensureAttrs(others)
  }
}
