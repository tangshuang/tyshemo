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
import Meta from './meta.js'

export class FactoryMeta extends Meta {
  constructor(options) {
    const { $entries, ...opts } = options
    super(opts)
    define(this, '$entries', () => $entries)
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

      entity.transport(child, parent)

      let deps = null

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

      // when the first time initialize, we can not collect deps,
      // so we collect deps after the first change
      const firstWatch = () => {
        deps = parent.collect(() => entity.transport(child, parent))
        parent.unwatch('*', firstWatch)
        deps.forEach((dep) => {
          parent.watch(dep, fn) // did not watch deeply
        })
      }

      parent.watch('*', firstWatch) // did not watch deeply
    }

    if (isList) {
      const Model = entity.entry(Entries[0])
      const filter = (items) => {
        const nexts = items.filter((item) => {
          if (Entries.some(One => isInstanceOf(item, One))) {
            return true
          }
          if (isObject(item)) {
            return true
          }
          return false
        })
        return nexts
      }
      const gen = (parent, items, key) => {
        const nexts = filter(items)
        const values = nexts.map((next) => {
          const model = Entries.some(One => isInstanceOf(next, One)) ? next.setParent([parent, key])
            : isObject(next) ? new Model(next, [parent, key])
            : new Model({}, [parent, key])
          const child = entity.instance(model, parent)
          setupTransport(child, parent, key)
          return child
        })
        return values
      }

      const options = {
        ...attrs,
        default: entity.default(function(key) {
          const items = isFunction(_default) ? _default.call(this, key) : _default
          const values = isArray(items) ? items : []
          return gen(this, values, key)
        }),
        type: entity.type(Entries),
        validators: entity.validators([
          {
            validate: ms => flatArray(map(ms, m => m.validate())),
          },
          ..._validators,
        ]),
        create: entity.create(function(value, key) {
          return gen(this, isArray(value) ? value : [], key)
        }),
        save: entity.save((ms, key) => ({ [key]: ms.map(m => m.toJSON()) })),
        map: entity.map(ms => ms.map(m => m.toData())),
        setter: entity.setter(function(value, key) {
          return gen(this, isArray(value) ? value : [], key)
        }),
        $entries: Entries,
      }
      this.meta = new FactoryMeta(options)
    }
    else {
      const Model = entity.entry(Entries)
      const gen = function(parent, value, key) {
        const model = isInstanceOf(value, Model) ? value.setParent([parent, key])
          : isObject(value) ? new Model(value, [key], parent)
          : new Model({}, [key], parent)
        const child = entity.instance(model, parent)
        setupTransport(child, parent, key)
        return child
      }
      const options = {
        ...attrs,
        default: entity.default(function(key) {
          const value = isFunction(_default) ? _default.call(this, key) : _default
          return gen(this, value, key)
        }),
        type: entity.type(Model),
        validators: entity.validators([
          {
            validate: m => m.validate(),
          },
          ..._validators,
        ]),
        create: entity.create(function(value, key) {
          return gen(this, value, key)
        }),
        save: entity.save((m, key) => ({ [key]: m.toJSON() })),
        map: entity.map(m => m.toData()),
        setter: entity.setter(function(value, key) {
          return gen(this, value, key)
        }),
        $entries: Entries,
      }
      this.meta = new FactoryMeta(options)
    }
  }

  entry(Model) {
    return Model
  }
  instance(model) {
    return model
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

  static getMeta(entries, options, methods = {}) {
    const Constructor = this
    const entity = new Constructor(entries, options)
    Object.assign(entity, methods)
    return entity.meta
  }
}
export default Factory
