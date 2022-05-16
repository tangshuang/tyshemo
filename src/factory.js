import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  flatArray,
  isInstanceOf,
  isFunction,
  define,
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

export class Factory {
  // entries should be a Model constructor or an array of Model constructors
  constructor(entries, options) {
    this.entries = entries
    this.options = options
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
    } = this.options || {}

    const isList = isArray(Entries)

    const setupTransport = (child, parent, key) => {
      if (!entity.transport) {
        return
      }

      const register = () => {
        const deps = parent.collect(() => {
          entity.transport(child, parent)
        })

        const fn = () => {
          entity.transport(child, parent)

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
        const nexts = filter(items)
        const values = nexts.map((next) => {
          const ChoosedModel = entity.entry(Entries, next, key, parent)
          if (!ChoosedModel) {
            throw new Error('[TySheMo]: Factory.entry Model not found!')
          }
          const model = this.adapt(Entries, next) ? next.setParent([parent, key])
            : isObject(next) ? new ChoosedModel(next, { parent, key })
              : new ChoosedModel({}, { parent, key })
          if (!model) {
            return
          }
          const child = entity.instance(model, parent)
          setupTransport(child, parent, key)
          return child
        })
        const outs = values.filter(item => item)
        return outs
      }

      const options = {
        ...attrs,
        default: entity.default(function(key) {
          const items = isFunction(_default) ? _default.call(this, key) : _default
          const values = isArray(items) ? items : []
          return gen(values, key, this)
        }),
        type: entity.type(Entries),
        validators: entity.validators([
          {
            validate: ms => flatArray(map(ms, m => m.validate())),
          },
          ..._validators,
        ]),
        create: entity.create(function(value, key) {
          return gen(isArray(value) ? value : [], key, this)
        }),
        save: entity.save((ms, key) => ({ [key]: ms.map(m => m.toJSON()) })),
        map: entity.map(ms => ms.map(m => m.toData())),
        setter: entity.setter(function(value, key) {
          return gen(isArray(value) ? value : [], key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      this.meta = new FactoryMeta(options)
    }
    else {
      const Entry = entity.entry(Entries)
      const gen = function(value, key, parent) {
        const ChoosedModel = entity.entry(Entries, value, key, parent)
        if (!ChoosedModel) {
          throw new Error('[TySheMo]: Factory.entry Model not found!')
        }
        const model = entity.adapt(Entries, value) ? value.setParent([parent, key])
          : isObject(value) ? new ChoosedModel(value, { key, parent })
            : new ChoosedModel({}, { key, parent })
        const child = entity.instance(model, parent)
        setupTransport(child, parent, key)
        return child
      }
      const options = {
        ...attrs,
        default: entity.default(function(key) {
          const value = isFunction(_default) ? _default.call(this, key) : _default
          return gen(value, key, this)
        }),
        type: entity.type(Entry),
        validators: entity.validators([
          {
            validate: m => m.validate(),
          },
          ..._validators,
        ]),
        create: entity.create(function(value, key) {
          return gen(value, key, this)
        }),
        save: entity.save((m, key) => ({ [key]: m.toJSON() })),
        map: entity.map(m => m.toData()),
        setter: entity.setter(function(value, key) {
          return gen(value, key, this)
        }),
        $entries: Entries,
        $create: gen,
      }
      this.meta = new FactoryMeta(options)
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

  /**
   * @deprecated
   * @param {*} Model
   * @param {*} attrs
   * @returns
   */
  static useAttrs(Model, attrs) {
    class NewModel extends Model {}
    attrs.forEach(([field, attr, fn]) => {
      const meta = Model[field]
      if (isInstanceOf(meta, Meta)) {
        NewModel[field] = meta.extends({
          [attr]: fn(meta[attr], meta),
        })
      }
      else if (isInheritedOf(meta, Meta)) {
        NewModel[field] = meta.extends({
          [attr]: fn(meta[attr], meta),
        })
      }
    })
    return NewModel
  }

  static createMeta(entries, attrs, hooks = {}) {
    const Constructor = this
    const entity = new Constructor(entries, attrs)
    Object.assign(entity, hooks)
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
}

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
