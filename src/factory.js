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
    const { entries, ...opts } = options
    super(opts)
    define(this, 'entries', () => entries)
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
    if (isArray(Entries)) {
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
      const gen = (ctx, items, key) => {
        const nexts = filter(items)
        const values = nexts.map((next) => {
          const model = Entries.some(One => isInstanceOf(next, One)) ? next.setParent([ctx, key])
            : isObject(next) ? new Model(next, [ctx, key])
            : new Model({}, [ctx, key])
          return entity.instance(model, ctx)
        })
        return values
      }

      this.meta = new FactoryMeta({
        default: entity.default(() => []),
        type: entity.type(Entries),
        validators: entity.validators([
          {
            validate: ms => flatArray(map(ms, m => m.validate())),
          },
        ]),
        create: entity.create(function(value, key) {
          return gen(this, isArray(value) ? value : [], key)
        }),
        save: entity.save((ms, key) => ({ [key]: ms.map(m => m.toJSON()) })),
        map: entity.map(ms => ms.map(m => m.toData())),
        setter: entity.setter(function(value, key) {
          return gen(this, isArray(value) ? value : [], key)
        }),
        entries: Entries,
      })
    }
    else {
      const Model = entity.entry(Entries)
      const gen = function(ctx, value, key) {
        const model = isInstanceOf(value, Model) ? value.setParent([ctx, key])
          : isObject(value) ? new Model(value, [key], ctx)
          : new Model({}, [key], ctx)
        return entity.instance(model, ctx)
      }
      this.meta = new FactoryMeta({
        default: entity.default(function(key) {
          return gen(this, {}, key)
        }),
        type: entity.type(Model),
        validators: entity.validators([
          {
            validate: m => m.validate(),
          },
        ]),
        create: entity.create(function(value, key) {
          return gen(this, value, key)
        }),
        save: entity.save((m, key) => ({ [key]: m.toJSON() })),
        map: entity.map(m => m.toData()),
        setter: entity.setter(function(value, key) {
          return gen(this, value, key)
        }),
        entries: Entries,
      })
    }

    if (isFunction(this.options)) {
      const next = this.options(this.meta) || {}
      this.meta = { ...this.meta, ...next }
    }
    else if (this.options) {
      this.meta = { ...this.meta, ...this.options }
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

  static getMeta(entries, options) {
    const Constructor = this
    const entity = new Constructor(entries, options)
    return entity.meta
  }
}
export default Factory
