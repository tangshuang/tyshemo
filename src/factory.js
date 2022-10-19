import {
  isObject,
  isArray,
  isInstanceOf,
  isFunction,
  define,
  flat,
  each,
} from 'ts-fns'
import { Meta } from './meta.js'
import { Model } from './model.js'

export class FactoryMeta extends Meta {
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
    const entity = this

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

    const isList = isArray(Entries)

    const setupLinkage = (child, parent, key) => {
      // do only once
      if (entity.transport) {
        entity.transport(child, parent, key)
      }

      // --------

      if (!entity.linkage) {
        return
      }

      const register = () => {
        const deps = parent.collect(() => {
          entity.linkage(child, parent)
        })

        const fn = () => {
          entity.linkage(child, parent)

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

    if (isList) {
      const filter = (items) => {
        const nexts = items.filter((item) => {
          if (this.adapt(Entries, item)) {
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
        const nexts = filter(items)
        const values = nexts.map((next) => {
          const FoundModel = entity.entry(Entries, next, key, parent)
          if (!FoundModel) {
            throw new Error('[TySheMo]: Factory.entry Model not found!')
          }
          const ChoosedModel = scenes ? FoundModel.Scene(scenes) : FoundModel
          if (entity.override) {
            ChoosedModel.prototype._takeOverrideMetas = function() {
              return entity.override(this, parent)
            }
          }
          const model = this.adapt(Entries, next) ? next.setParent([parent, key])
            : isObject(next) ? new ChoosedModel(next, { parent, key })
              : new ChoosedModel({}, { parent, key })
          if (!model) {
            return
          }
          const child = entity.instance(model, parent)
          setupLinkage(child, parent, key)
          return child
        })
        const outs = values.filter(item => item)
        return outs
      }

      const attributes = {
        ...attrs,
        default: entity.default(function(key) {
          const items = isFunction(_default) ? _default.call(this, key) : _default
          const values = isArray(items) ? items : []
          return gen(values, key, this)
        }),
        type: entity.type(Entries),
        validators: entity.validators(_validators),
        create: entity.create(function(value, key, json) {
          const coming = _create ? _create.call(this, value, key, json) : value
          return gen(isArray(coming) ? coming : [], key, this)
        }),
        save: entity.save(_save || ((ms) => ms.map(m => m.toJSON()))),
        map: entity.map(_map || (ms => ms.map(m => m.toData()))),
        setter: entity.setter(function(value, key) {
          const coming = _setter ? _setter.call(this, value, key) : value
          return gen(isArray(coming) ? coming : [], key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      this.meta = new FactoryMeta(attributes)
    }
    else {
      const Entry = entity.entry(Entries)
      const gen = function(value, key, parent) {
        const scenes = parent.$$scenes
        const FoundModel = entity.entry(Entries, value, key, parent)
        if (!FoundModel) {
          throw new Error('[TySheMo]: Factory.entry Model not found!')
        }
        const ChoosedModel = scenes ? FoundModel.Scene(scenes) : FoundModel
        if (entity.override) {
          ChoosedModel.prototype._takeOverrideMetas = function() {
            return entity.override(this, parent)
          }
        }
        const model = entity.adapt(Entries, value) ? value.setParent([parent, key])
          : isObject(value) ? new ChoosedModel(value, { key, parent })
            : new ChoosedModel({}, { key, parent })
        const child = entity.instance(model, parent)
        setupLinkage(child, parent, key)
        return child
      }
      const attributes = {
        ...attrs,
        default: entity.default(function(key) {
          const value = isFunction(_default) ? _default.call(this, key) : _default
          return gen(value, key, this)
        }),
        type: entity.type(Entry),
        validators: entity.validators(_validators),
        create: entity.create(function(value, key, json) {
          const coming = _create ? _create.call(this, value, key, json) : value
          return gen(coming, key, this)
        }),
        save: entity.save(_save || ((m) => m.toJSON())),
        map: entity.map(_map || (m => m.toData())),
        setter: entity.setter(function(value, key) {
          const coming = _setter ? _setter.call(this, value, key) : value
          return gen(coming, key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      this.meta = new FactoryMeta(attributes)
    }
  }

  /**
   * choose which Model to use when
   * @param {*} Entries
   * @param {*} data
   * @param {*} key
   * @param {*} parent
   * @returns
   */
  entry(Entries, _data, _key, _parent) {
    return isArray(Entries) ? Entries[0] : Entries
  }
  /**
   * modify or change Model instance
   * @param {*} model
   * @returns
   */
  instance(model) {
    return model
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
    const entity = new Constructor(entries, attrs)
    return entity.getMeta()
  }

  /**
   * @deprecated
   */
  static getMeta(entries, attrs, hooks = {}) {
    return this.createMeta(entries, attrs, hooks)
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
    class SharedModel extends Model {
      static [Symbol.hasInstance](target) {
        return items.some((Model) => target instanceof Model)
      }
    }
    return this.createMeta(isList ? [SharedModel] : SharedModel, attrs, {
      ...hooks,
      entry(_, data, key, parent) {
        return select(items, data, key, parent)
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
