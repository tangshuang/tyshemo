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
} from 'ts-fns'
import { Validator } from './validator.js'
import { ofChain } from './shared/utils.js'
import { RESERVED_ATTRIBUTES } from './shared/configs.js'

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
    const properties = ofChain(this, Meta, ['Scene'])
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
      if (['constructor', 'extend', 'fetchAsyncAttrs', 'defineScenes', 'switchScene', 'Scene'].includes(key)) {
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

  extend(attrs = {}) {
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

const AsyncMetaSymbol = Symbol()
const ensureAttrs = (attrs) => {
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
            const data = model._getData(key)
            return getter.call(this, data, key)
          },
          enumerable: true,
          configurable: true,
        })
      })
      model.$store.forceDispatch(`!${key}`, message)
    })
  })
}

export class AsyncMeta extends Meta {
  constructor(attrs = {}) {
    super()
    const Constructor = getConstructorOf(this)
    let ready = Object.getOwnPropertyDescriptor(Constructor, AsyncMetaSymbol)?.value
    if (!ready) {
      ready = Constructor[AsyncMetaSymbol] = {
        notifiers: [],
      }
    }
    // fetch each time inistalized
    this.fetchAsyncAttrs().then((data) => {
      const next = ensureAttrs({
        ...data,
        ...attrs,
      })
      useAttrs(this, next)
      notifyAttrs(ready.notifiers, next, 'async meta')
      ready.notifiers.length = 0
    })
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
    }
    ready.notifiers.push({ model, key })
  }
}

const SceneMetaSymbol = Symbol()
export class SceneMeta extends Meta {
  constructor(attrs = {}) {
    super(attrs)
    this[SceneMetaSymbol] = {
      codes: [],
      default: { ...this },
      passed: attrs,
      notifiers: [],
      disabled: false,
    }
  }
  defineScenes() {
    return {}
  }
  switchScene(sceneCodes) {
    const { codes, passed, default: defaultAttrs, notifiers, disabled } = this[SceneMetaSymbol]
    if (disabled) {
      return
    }

    sceneCodes = isArray(sceneCodes) ? sceneCodes : [sceneCodes]
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
        Object.assign(attrs, ensureAttrs(scene))
      })
      const next = ensureAttrs({
        ...defaultAttrs,
        ...attrs,
        ...passed,
      })
      useAttrs(this, next)
      return next
    }

    const finish = () => {
      notifiers.length = 0
    }

    const deferers = []
    const patches = []

    sceneCodes.forEach((code) => {
      const scene = use(code)
      if (!scene) {
        return
      }
      if (scene instanceof Promise) {
        deferers.push(scene)
      }
      // if existing async scene, make it async
      else if (deferers.length) {
        deferers.push(Promise.resolve(scene))
      }
      else {
        patches.push(scene)
      }
    })

    if (deferers.length) {
      Promise.all(deferers).then((scenes) => {
        return update(scenes)
      }).then((attrs) => {
        this[SceneMetaSymbol].codes = sceneCodes
        notifyAttrs(notifiers, attrs, 'scene meta')
      }).finally(() => {
        finish()
      })
    }
    else if (patches.length) {
      const attrs = update(patches)
      this[SceneMetaSymbol].codes = sceneCodes
      notifyAttrs(notifiers, attrs, 'scene meta')
      finish()
    }
    else {
      finish()
    }

    return this
  }
  _awaitMeta(model, key) {
    const { notifiers } = this[SceneMetaSymbol]
    notifiers.push({ model, key })
  }

  Scene(sceneCodes) {
    const { passed } = this[SceneMetaSymbol]
    const Constructor = getConstructorOf(this)
    const NewMetaClass = Constructor.Scene(sceneCodes)
    const newMeta = new NewMetaClass(passed)
    Object.setPrototypeOf(newMeta, this) // make it impossible to use meta
    return newMeta
  }

  static Scene(sceneCodes) {
    const Constructor = this
    class SceneModel extends Constructor {
      constructor(attrs) {
        super(attrs)
        this.switchScene(sceneCodes)
        this[SceneMetaSymbol].disabled = true
      }
    }
    return SceneModel
  }
}
