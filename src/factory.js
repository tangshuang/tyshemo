import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  flatArray,
  isInstanceOf,
  isFunction,
  isNumeric,
  isNumber,
} from 'ts-fns'
import Meta from './meta.js'

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
      const prox = function(ctx, items, key) {
        const createInserter = (method) => {
          const originalInsert = items[method].bind(items)
          const inserter = function(...args) {
            const nexts = filter(...args)
            const values = nexts.map((next) => {
              const model = Entries.some(One => isInstanceOf(next, One)) ? next
                : isObject(next) ? new Model(next)
                : new Model({})
              return model
            })
            const res = originalInsert(...values)
            items.forEach((item) => {
              item.setParent([ctx, key])
            })
            ctx.dispatch(key, items, items, true)
            return res
          }
          return inserter
        }
        const createModifier = (method) => {
          const originalModify = items[method].bind(items)
          const modifier = function(...args) {
            const res = originalModify(...args)
            ctx.dispatch(key, items, items, true)
            return res
          }
          return modifier
        }
        const proxy = new Proxy(items, {
          get: (_, k) => {
            // const methods = [
            //   'push', 'unshift',
            //   'splice',
            //   'shift', 'pop',
            //   'sort', 'reverse', 'fill',
            // ]
            if (['push', 'unshift'].includes(k)) {
              console.log(k)
              return createInserter(k)
            }
            else if (['splice', 'shift', 'pop', 'sort', 'reverse', 'fill'].includes(k)) {
              return createModifier(k)
            }
            else if (isFunction(items[k])) {
              return items[k].bind(items)
            }
            else {
              return items[k]
            }
          },
          set: (_, k, value) => {
            if (isNumber(k) || isNumeric(k)) {
              const model = Entries.some(One => isInstanceOf(value, One)) ? value.setParent([ctx, key])
                : isObject(value) ? new Model(value, [ctx, key])
                : new Model({}, [ctx, key])
              model.setParent([ctx, key])
            }
            else {
              items[k] = value
            }
            ctx.dispatch(key, items, items, true)
            return true
          },
          defineProperty: (_, k) => {
            delete items[k]
            ctx.dispatch(key, items, items, true)
            return true
          }
        })
        return proxy
      }
      const gen = (ctx, items, key) => {
        const nexts = filter(items)
        const values = nexts.map((next) => {
          const model = Entries.some(One => isInstanceOf(next, One)) ? next.setParent([ctx, key])
            : isObject(next) ? new Model(next, [ctx, key])
            : new Model({}, [ctx, key])
          return entity.instance(model, ctx)
        })

        return prox(ctx, values, key)
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
          return gen(this, isArray(value) ? value : [], key)
        }),
        save: entity.save((ms, key) => ({ [key]: ms.map(m => m.toJSON()) })),
        map: entity.map(ms => ms.map(m => m.toData())),
        setter: entity.setter(function(value, key) {
          return gen(this, isArray(value) ? value : [], key)
        }),
        getter(value, key) {
          return prox(ctx, value, key)
        },
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
      this.meta = new Meta({
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
