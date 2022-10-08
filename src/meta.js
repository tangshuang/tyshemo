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
      if (['constructor', 'extend', 'fetchAsyncAttrs', 'defineScenes', 'switchScene', 'initScene', 'Scene'].includes(key)) {
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
      useAttrs(this, data)
      useAttrs(this, attrs)
      ready.notifiers.forEach(({ model, key }) => {
        model.$store.forceDispatch(`!${key}`, 'async meta')
      })
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
      code: '',
      default: { ...this },
      keep: attrs,
      notifiers: [],
      disabled: false,
    }
  }
  defineScenes() {
    return {}
  }
  switchScene(sceneCode) {
    const { code, keep, default: defaultAttrs, notifiers, disabled } = this[SceneMetaSymbol]
    if (code === sceneCode || disabled) {
      return
    }
    const scenes = this.defineScenes()
    const scene = scenes[sceneCode]
    const update = (attrs, emit) => {
      Object.assign(this, defaultAttrs)
      Object.assign(this, attrs)
      Object.assign(this, keep)
      if (emit) {
        notifiers.forEach(({ model, key }) => {
          model.$store.forceDispatch(`!${key}`, 'scene meta')
        })
        notifiers.length = 0
      }
    }
    if (scene) {
      // delete prev scene attrs at first
      const prevScene = scenes[code]
      if (prevScene) {
        const keys = Object.keys(prevScene)
        keys.forEach((key) => {
          delete this[key]
        })
      }

      this[SceneMetaSymbol].code = sceneCode
      if (typeof scene === 'function') {
        const res = scene()
        if (res instanceof Promise) {
          res.then((data) => {
            update(data, true)
          })
        }
        else {
          update(res)
        }
      }
      else {
        update(scene)
      }
    }
    else {
      console.error(`[TySheMo]: Scene ${sceneCode} is not defined on Meta`, this)
    }
    return this
  }
  _awaitMeta(model, key) {
    const { notifiers } = this[SceneMetaSymbol]
    notifiers.push({ model, key })
  }

  Scene(sceneCode) {
    const { keep } = this[SceneMetaSymbol]
    const Constructor = getConstructorOf(this)
    const NewMetaClass = Constructor.Scene[sceneCode]
    const newMeta = new NewMetaClass(keep)
    Object.setPrototypeOf(newMeta, this) // make it impossible to use meta
    return newMeta
  }

  static get Scene() {
    const Constructor = this
    return new Proxy({}, {
      get(_, sceneCode) {
        class SceneModel extends Constructor {
          constructor(attrs) {
            super(attrs)
            this.switchScene(sceneCode)
            this[SceneMetaSymbol].disabled = true
          }
        }
        return SceneModel
      },
    })
  }
}
