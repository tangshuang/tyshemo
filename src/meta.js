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
  isString,
  isObject,
} from 'ts-fns'
import { Validator } from './validator.js'
import { ofChain, traverseChain } from './shared/utils.js'
import { RESERVED_ATTRIBUTES } from './shared/configs.js'

const AsyncMetaSymbol = Symbol()
const SceneMetaSymbol = Symbol()
const SceneCodesSymbol = Symbol()

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

  extend(attrs = {}) {
    const Constructor = getConstructorOf(this)
    class NewConstructor extends Constructor {}

    let attrset = { ...attrs }
    // merge passed attrs
    const sceneInfo = this[SceneMetaSymbol]
    if (sceneInfo) {
      const passed = sceneInfo.passed || {}
      attrset = { ...passed, ...attrs }
    }

    if (attrs.validators) {
      attrset.validators = mergeValidators(this, attrs.validators)
    }

    // merge attrs, should before new NewConstructor, because we need to keep inherited attributes inside,
    // if we merge after new, default attributes of SceneMeta will not be as expected
    each(this, (descriptor, attr) => {
      if (typeof attr === 'symbol') {
        return
      }
      if (!descriptor.configurable) {
        return
      }
      define(NewConstructor, attr, descriptor)
    }, true)

    // pass attrs so that it will be used as passed attrs in scene meta
    const meta = new NewConstructor(attrset)

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

  static create(attrs) {
    const Constructor = inherit(Meta, null, attrs)
    return Constructor
  }
}

export class AsyncMeta extends Meta {
  constructor(attrs = {}) {
    super()
    this[AsyncMetaSymbol] = {
      attrs,
    }
  }
  fetchAsyncAttrs() {
    return Promise.resolve({})
  }
  _awaitMeta(model, key) {
    const Constructor = getConstructorOf(this)
    let ready = Object.getOwnPropertyDescriptor(Constructor, AsyncMetaSymbol)?.value
    if (!ready) {
      ready = Constructor[AsyncMetaSymbol] = {
        notifiers: [],
      }
      // fetch only once
      this.fetchAsyncAttrs().then((data) => {
        const { attrs } = this[AsyncMetaSymbol]
        const next = ensureAttrs({
          ...data,
          ...attrs,
        })
        this.__useAttrs(next)
        notifyAttrs(ready.notifiers, next, 'async meta')
        ready.notifiers.length = 0
      })
    }
    ready.notifiers.push({ model, key })
  }
}

export class SceneMeta extends Meta {
  __init(descriptors, attrs) {
    super.__init(descriptors, attrs)
    this[SceneMetaSymbol] = {
      codes: [],
      default: { ...this },
      passed: attrs,
      notifiers: [],
      disabled: false,
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
    const { codes, passed, default: defaultAttrs, notifiers, disabled } = this[SceneMetaSymbol]
    if (disabled) {
      return
    }

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

    const clear = () => {
      // delete prev scene attrs at first
      const prevScenes = codes.map((code) => scenes[code] || {})
      const prevAttrs = prevScenes.reduce((attrs, scene) => {
        return [...attrs, Object.keys(scene)]
      }, [])
      if (prevAttrs.length) {
        prevAttrs.forEach((key) => {
          delete this[key]
        })
      }
    }

    const update = (scenes) => {
      clear()
      const attrs = {}
      scenes.forEach((scene) => {
        Object.assign(attrs, this._ensureAttrs(scene))
      })
      const next = this._ensureAttrs({
        ...defaultAttrs,
        ...attrs,
        ...passed,
      })
      this.__useAttrs(next)
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
      // update some scenes before async
      const preloadScenes = results.filter(item => !(item instanceof Promise))
      if (preloadScenes.length) {
        const preloadAttrs = update(preloadScenes)
        notifyAttrs(notifiers, preloadAttrs, 'scene meta')
        // dont finish it
      }

      return Promise.all(results.map(item => item instanceof Promise ? item : Promise.resolve(item)))
        .then((scenes) => {
          return update(scenes)
        })
        .then((attrs) => {
          notifyAttrs(notifiers, attrs, 'scene meta')
        })
        .finally(() => {
          finish()
        })
    }
    else if (results.length) {
      const attrs = update(results)
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

  Scene(sceneCode) {
    const { passed } = this[SceneMetaSymbol]
    const Constructor = getConstructorOf(this)
    const NewMetaClass = Constructor.Scene(sceneCode)
    const newMeta = new NewMetaClass(passed)
    Object.setPrototypeOf(newMeta, this) // make it impossible to use meta
    return newMeta
  }

  static Scene(sceneCode) {
    const Constructor = this
    class PresistSceneMeta extends Constructor {
      _initSceneCode() {
        const sceneCodes = []
        const Constructor = getConstructorOf(this)
        const unshift = (item) => {
          if (!sceneCodes.includes(item)) {
            sceneCodes.unshift(item)
          }
        }
        const pushSceneCodes = (target) => {
          if (isArray(target[SceneCodesSymbol])) {
            target[SceneCodesSymbol].forEach(unshift)
          }
          else if (isString(target[SceneCodesSymbol])) {
            unshift(target[SceneCodesSymbol])
          }
        }
        traverseChain(Constructor, SceneMeta, pushSceneCodes)
        this.switchScene(sceneCodes)
        this[SceneMetaSymbol].disabled = true
      }
      static [SceneCodesSymbol] = sceneCode
    }
    return PresistSceneMeta
  }
}

/**
 * special meta which treated as state, the following attributes not working: default, drop, to, map, state
 * should must pass `value`
 */
export class StateMeta extends Meta {
  __init(descriptors, attrs) {
    const { value, ...others } = attrs
    delete others.drop
    delete others.state
    delete others.default

    const desc = { ...descriptors }
    delete desc.drop
    delete desc.state
    desc.default = isUndefined(value) ? descriptors.value : value

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
