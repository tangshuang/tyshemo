import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  flatArray,
  isInstanceOf,
} from 'ts-fns'
import Meta from './meta.js'

export class Entity {
  // entries should be a Model constructor or an array of Model constructors
  constructor(entries) {
    this.entries = entries
    this.meta = null
    this.init(entries)
  }
  init(Entries) {
    const entity = this
    if (isArray(Entries)) {
      const Model = entity.entry(Entries[0])
      const gen = function(items, key) {
        const nexts = items.filter((item) => {
          if (Entries.some(One => isInstanceOf(item, One))) {
            return true
          }
          if (isObject(item)) {
            return true
          }
          return false
        })
        const values = nexts.map((next, i) => {
          const model = Entries.some(One => isInstanceOf(next, One)) ? next.setParent([key, i], this)
            : isObject(next) ? new Model(next, [key, i], this)
            : new Model({}, [key, i], this)
          return entity.instance(model, this)
        })
        return values
      }

      this.meta = new Meta({
        default: entity.default(() => []),
        type: entity.type(Entries),
        validators: entity.validators([
          {
            validate: ms => flatArray(map(ms, m => m.validate())),
          },
        ]),
        create: entity.create(function(value, key) {
          return isArray(value) ? gen.call(this, value, key) : []
        }),
        save: entity.save((ms, key) => ({ [key]: ms.map(m => m.toJSON()) })),
        map: entity.map(ms => ms.map(m => m.toData())),
        setter: entity.setter(function(value, key) {
          return isArray(value) ? gen.call(this, value, key) : []
        }),
      })
    }
    else {
      const Model = entity.entry(Entries)
      const gen = function(value, key) {
        const model = isInstanceOf(value, Model) ? value.setParent([key], this)
          : isObject(value) ? new Model(value, [key], this)
          : new Model({}, [key], this)
        return entity.instance(model, this)
      }
      this.meta = new Meta({
        default: entity.default(function(key) {
          return gen.call(this, {}, key)
        }),
        type: entity.type(Model),
        validators: entity.validators([
          {
            validate: m => m.validate(),
          },
        ]),
        create: entity.create(function(value, key) {
          return gen.call(this, value, key)
        }),
        save: entity.save((m, key) => ({ [key]: m.toJSON() })),
        map: entity.map(m => m.toData()),
        setter: entity.setter(function(value, key) {
          return gen.call(this, value, key)
        }),
      })
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

  static getMeta(entries) {
    const Constructor = this
    const entity = new Constructor(entries)
    return entity.meta
  }
}
export default Entity
