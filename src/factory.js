import {
  isObject,
  isArray,
  isInstanceOf,
  isFunction,
  define,
  flat,
  each,
  decideby,
} from 'ts-fns'
import { SceneMeta } from './meta.js'

export class FactoryMeta extends SceneMeta {
  constructor(options) {
    const { $entries, $create, ...opts } = options
    super(opts)
    define(this, '$entries', () => $entries)
    define(this, '$create', () => $create)
  }
}

export class FactoryChunk {
  constructor(options) {
    Object.assign(this, options)
  }
}

export class Factory {
  // entries should be a Model constructor or an array of Model constructors
  constructor(entries, attrs) {
    this.entries = entries
    this.attrs = attrs
    this.meta = null
    this.init(entries)
  }

  /**
   * @param {Model|Model[]} Entries
   */
  init(Entries) {
    const factory = this
    const isList = isArray(Entries)

    const {
      default: _default,
      validators: _validators = [],
      // the following ones are no use
      type: _type,
      create: _create,
      save: _save,
      map: _map,
      setter: _setter,
      getter: _getter,
      ...attrs
    } = this.attrs || {}

    const setupLinkage = (child, parent, key) => {
      const scenes = parent.$$scenes

      // do only once
      if (factory.transport) {
        factory.transport(child, parent, scenes)
      }

      // --------

      if (!factory.linkage) {
        return
      }

      const register = () => {
        const deps = parent.collect(() => {
          factory.linkage(child, parent, scenes)
        })

        const fn = () => {
          factory.linkage(child, parent, scenes)

          // -------
          // check whether the child is in parent model, if not, remove watchers

          if (!deps) {
            return
          }

          const unwatch = () => {
            deps.forEach((dep) => {
              parent.unwatch(dep, fn)
            })
          }

          const sub = parent[key]
          if (isList) {
            if (!sub.includes(child)) {
              unwatch()
            }
          }
          else {
            if (sub !== child) {
              unwatch()
            }
          }
        }

        deps.forEach((dep) => {
          parent.watch(dep, fn) // did not watch deeply
        })

        parent.off('init', register)
      }

      // when setup transport, the parent is not built ready,
      // we should must wait it ready to collect deps
      if (!parent.$ready) {
        parent.on('init', register)
      }
      else {
        register()
      }
    }

    class ThisFactoryMeta extends FactoryMeta {
      defineScenes() {
        if (isFunction(factory.scenes)) {
          return factory.scenes()
        }
        return {}
      }
    }

    if (isList) {
      const filter = (items, key, parent) => {
        const nexts = items.filter((item) => {
          if (this.adapt(Entries, item, key, parent)) {
            return true
          }
          if (isObject(item)) {
            return true
          }
          return false
        })
        return nexts
      }
      const gen = (items, key, parent) => {
        const scenes = parent.$$scenes
        const nexts = filter(items, key, parent)
        const values = nexts.map((next) => {
          const FoundModel = factory.select(Entries, next, parent, key)
          if (!FoundModel) {
            throw new Error('[TySheMo]: Factory.select Model not found!')
          }
          const LocalModel = scenes ? FoundModel.Scene(scenes) : FoundModel
          const ChoosedModel = parent.$$editof ? class extends LocalModel.Edit() {} : class extends LocalModel {}
          if (factory.override) {
            ChoosedModel.prototype._takeOverrideMetas = function() {
              return factory.override(this, parent, scenes)
            }
          }
          const child = decideby(() => {
            if (this.adapt(Entries, next, parent, key)) {
              return next.setParent([parent, key])
            }
            if (isObject(next)) {
              return factory.instance(ChoosedModel, next, { parent, key, scenes })
            }
            return factory.instance(ChoosedModel, {}, { parent, key, scenes })
          })
          if (!child) {
            return
          }
          setupLinkage(child, parent, key)
          return child
        })
        const outs = values.filter(item => item)
        return outs
      }

      const attributes = {
        default: factory.default(function(key) {
          const items = isFunction(_default) ? _default.call(this, key) : _default
          const values = isArray(items) ? items : []
          return gen(values, key, this)
        }),
        type: factory.type(Entries),
        validators: factory.validators(_validators),
        create: factory.create(function(value, key, json) {
          const coming = _create ? _create.call(this, value, key, json) : value
          return gen(isArray(coming) ? coming : [], key, this)
        }),
        save: factory.save(_save || ((ms) => ms.map(m => m.Chunk().toJSON()))),
        map: factory.map(_map || (ms => ms.map(m => m.Chunk().toData()))),
        setter: factory.setter(function(value, key) {
          const coming = _setter ? _setter.call(this, value, key) : value
          return gen(isArray(coming) ? coming : [], key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      Object.assign(ThisFactoryMeta, attrs)
      this.meta = new ThisFactoryMeta(attributes)
    }
    else {
      const gen = function(value, key, parent) {
        const scenes = parent.$$scenes
        const FoundModel = factory.select(Entries, value, parent, key)
        if (!FoundModel) {
          throw new Error('[TySheMo]: Factory.select Model not found!')
        }
        const LocalModel = scenes ? FoundModel.Scene(scenes) : FoundModel
        const ChoosedModel = parent.$$editof ? class extends LocalModel.Edit() {} : class extends LocalModel {}
        if (factory.override) {
          ChoosedModel.prototype._takeOverrideMetas = function() {
            return factory.override(this, parent, scenes)
          }
        }
        const child = decideby(() => {
          if (factory.adapt(Entries, value, key, parent)) {
            return value.setParent([parent, key])
          }
          if (isObject(value)) {
            return factory.instance(ChoosedModel, value, { key, parent, scenes })
          }
          return factory.instance(ChoosedModel, {}, { key, parent, scenes })
        })
        setupLinkage(child, parent, key)
        return child
      }
      const attributes = {
        default: factory.default(function(key) {
          const value = isFunction(_default) ? _default.call(this, key) : _default
          return gen(value, key, this)
        }),
        type: factory.type(Entries),
        validators: factory.validators(_validators),
        create: factory.create(function(value, key, json) {
          const coming = _create ? _create.call(this, value, key, json) : value
          return gen(coming, key, this)
        }),
        save: factory.save(_save || ((m) => m.Chunk().toJSON())),
        map: factory.map(_map || (m => m.Chunk().toData())),
        setter: factory.setter(function(value, key) {
          const coming = _setter ? _setter.call(this, value, key) : value
          return gen(coming, key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      Object.assign(ThisFactoryMeta, attrs)
      this.meta = new ThisFactoryMeta(attributes)
    }
  }

  /**
   * choose which Model to use before instance
   * @param {*} Entries
   * @param {*} data
   * @param {*} key
   * @param {*} parent
   * @returns
   */
  select(Entries) {
    return isArray(Entries) ? Entries[0] : Entries
  }
  /**
   * modify or change Model instance
   * @param {*} model
   * @returns
   */
  instance(ChoosedModel, data, options) {
    return new ChoosedModel(data, options)
  }
  /**
   * detect whether a data is adapt to Entries
   * @param {*} Entries
   * @param {*} data
   * @returns {boolean}
   */
  adapt(Entries, data) {
    return isArray(Entries) ? Entries.some(Entry => isInstanceOf(data, Entry)) : isInstanceOf(data, Entries)
  }

  // transport
  // linkage
  // override

  default(fn) {
    return fn
  }
  type(type) {
    return type
  }
  validators(validators) {
    return validators
  }
  create(fn) {
    return fn
  }
  save(fn) {
    return fn
  }
  map(fn) {
    return fn
  }
  setter(fn) {
    return fn
  }

  getMeta() {
    return this.meta
  }

  static createMeta(entries, attrs, hooks) {
    class Constructor extends this {}
    if (hooks) {
      Object.assign(Constructor.prototype, hooks)
    }
    const factory = new Constructor(entries, attrs)
    return factory.getMeta()
  }

  /**
   * create a meta by given entries
   * @param {ModelClass[] | ModelClass[][]} entries
   * @param {ModelClass[] => Model} select
   * @param {object} [attrs]
   * @param {object} [hooks]
   * @returns {Meta}
   */
  static selectMeta(entries, select, attrs, hooks = {}) {
    const isList = isArray(entries[0])
    const items = isList ? entries[0] : entries
    const input = isList ? items : items[0]
    return this.createMeta(input, attrs, {
      ...hooks,
      select(_, data, parent, key) {
        return select(items, data, parent, key)
      },
      adapt(_, data) {
        return items.some(Entry => isInstanceOf(data, Entry))
      },
    })
  }

  /**
   * create a chunk for model
   * @param {*} options
   * @param {function} options.data (...params) => Promise<data>
   * @param {function} [options.fromJSON] (data) => JSON
   * @param {function} [options.toJSON] (model: Model) => JSON
   * @param {function} [options.toData] (model: Model) => data
   * @returns
   */
  static chunk(options) {
    return new FactoryChunk(options)
  }

  static toParams(data, determine) {
    const output = flat(data, determine)
    return output
  }

  static toFormData(data, determine) {
    const params = Factory.toParams(data, determine)
    const formdata = new FormData()
    each(params, (value, key) => {
      formdata.append(key, value)
    })
    return formdata
  }
}
