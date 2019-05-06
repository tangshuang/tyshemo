import { isObject, isArray, inObject, isInstanceOf, assign, parse, isEmpty, isFunction, isBoolean, flatObject, isEqual } from './utils.js'
import TySheMoError, { makeError } from './error.js'
import List from './list.js'
import Rule from './rule.js'

/**
 * 数据源相关信息
 * definition是一个对象
 *
 * {
 *   // 字段名
 *   key: {
 *     type: String, // 可选，数据类型，assert 的时候使用
 *       // 注意：default 和 compute 的结果必须符合 type 的要求，这一点必须靠开发者自己遵守，TypeSchema 内部没有进行控制
 *     default: '', // 必填，默认值（parse 的时候使用）
 *     // 计算属性
 *     // 每次digest时同步
 *     compute: function() {
 *       const a = this.get('a')
 *       const b = this.get('b')
 *       return a + '' + b
 *     },
 *
 *     // 或者将多个校验器放在一个数组里面，这样可以根据不同的校验规则提示不同的错误信息，
 *     // 当给了validators，其他的校验配置失效（determine会保留，并且在所有的determine前执行
 *     validators: [
 *       {
 *         // 校验相关的配置
 *         validate: (value) => Boolean, // 可选，校验器，可以引入validators下的校验器，快速使用校验器
 *         determine: (value) => Boolean, // 决定是否要执行这个校验器，如果返回false，则忽略该校验器的校验规则
 *         message: '', // 可选，校验失败的时候的错误信息
 *       },
 *     ],
 *
 *     // 从后台api拿到数据后恢复数据相关
 *     prepare: data => !!data.on_market, // 可选
 *       // 用一个数据去恢复模型数据，这个数据被当作prepare的参数data，prepare的返回值，将作为property的恢复后值使用
 *       // data就是override接收的参数
 *
 *     // 准备上传数据，格式化数据相关
 *     flat: (value) => ({ keyPath: value }), // 可选，在制作表单数据的时候，把原始值转换为新值赋值给model的keyPath。
 *       // value为map之前的值。
 *       // 在将一个字段展开为两个字段的时候会用到它。
 *       // 注意，使用了flat，如果想在结果中移除原始key，还需要使用drop。
 *       // 例如： flat: (region) => ({ 'company.region_id': region.region_id }) 会导致最后在构建表单的时候，会有一个company.region_id属性出现
 *       // flat的优先级更高，它会在drop之前运行，因此，drop对它没有影响，这也符合逻辑，flat之后，如果需要从原始数据中删除自身，需要设置drop
 *     drop: (value) => Boolean, // 可选，是否要在调用.jsondata或.formdata的时候排除当前这个字段
 *     map: (value) => newValue, // 可选，使用新值覆盖原始值输出，例如 map: region => region.region_id 使当前这个字段使用region.region_id作为最终结果输出。
 *       // 注意：它仅在drop为false的情况下生效，drop为true，map结果不会出现在结果中。
 *   },
 * }
 *
 * 需要注意：只有definition中规定的属性会被当作model最终生成formdata的字段，不在definition中规定的，但是仍然存在于model中的属性不会被加入到formdata中。
 * 当然，即使在definition中，但加了drop的也可能被排除出去。抑或，不在definition中，但flat和patch的新属性也会被加入到formdata结果中。
 *
 * 当一个属性的值为一个新的FormModel，或者为一个包含了FormModel的数组时，在生成最终的formdata的时候，会从这些FormModel中提取出真正的结果。
 */

export class Model {
  constructor(data = {}) {
    // 定义schema，进来的数据必须符合schema的要求，并且schema的输出字段将会被作为Model的字段，且schema的输出结果应该符合define的结构要求
    const definition = this.define()

    if (!isObject(definition)) {
      throw new TySheMoError('model.define should return an object.')
    }

    this.definition = definition
    this.schema = new Schema(definition)

    this.state = this.schema.ensure(data)
    this.listeners = {}
  }

  define() {
    throw new TySheMoError('model.define method should be override.')
  }

  get(keyPath) {
    return parse(this.state, keyPath)
  }

  set(keyPath, value) {
    assign(this.state, keyPath, value)
    return this
  }

  watch(keyPath, fn, deep = false) {
    const value = this.get(keyPath)
    const listener = this.listeners[keyPath]
    if (!listener) {
      this.listeners[keyPath] = {
        keyPath,
        value: null,
        callbacks: [],
      }
      listener = this.listeners[keyPath]
    }

    listener.value = clone(value)
    listener.callbacks.push({ fn, deep })
    return this
  }

  unwatch(keyPath, fn) {
    const listener = this.listeners[keyPath]
    const { callbacks } = listener
    callbacks.forEach((item, i) => {
      if (item.fn === fn || fn === undefined) {
        callbacks.splice(i, 1)
      }
    })
    return this
  }

  digest() {
    const listeners = Object.values(this.listeners)
    if (!listeners.length) {
      return this
    }

    // computed properties
    const definition = this.definition
    const keys = Object.keys(definition)
    const computers = []
    keys.forEach((key) => {
      const def = definition[key]
      if (isObject(def) && inObject('default', def) && inObject('type', def) && isFunction(def.compute)) {
        const { compute } = def
        computers.push({ key, compute })
      }
    })

    var dirty = false
    var count = 0

    const digest = () => {
      dirty = false

      // computing should come before callbacks, because current value of listeners may changed by computers
      computers.forEach(({ key, compute }) => {
        const value = compute.call(this)
        assign(this.state, key, value)
      })

      listeners.forEach((item) => {
        const { keyPath, value, callbacks } = item
        const current = this.get(keyPath)
        const previous = value

        // set current value before callbacks run, so that you can get current value in callback function by using `this.get(keyPath)`
        item.value = current

        if (!callbacks.length) {
          return
        }

        callbacks.forEach(({ fn, deep }) => {
          if (deep && !isEqual(current, previous)) {
            fn.call(this, current, previous)
            dirty = true
          }
          else if (!deep && current !== previous) {
            fn.call(this, current, previous)
            dirty = true
          }
        })
      })

      count ++
      if (count > 15) {
        throw new TySheMoError(`digest over 15 times.`)
      }

      if (dirty) {
        digest()
      }
    }

    digest()

    return this
  }

  // 批量更新，异步动作，多次更新一个值，只会触发一次
  update(data = {}) {
    // 通过调用 this.update() 强制刷新数据
    if (!isObject(data) || isEmpty(data)) {
      this.digest()
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          let error = this.schema.validate(this.state)
          if (error) {
            reject(error)
          }
          else {
            resolve(this.state)
          }
        })
      })
    }

    const definition = this.definition
    const keys = Object.keys(data)

    keys.forEach((key) => {
      // 不存在定义里的字段不需要
      if (!inObject(key, definition)) {
        return
      }
      const value = data[key]
      this.__update.push({ key, value })
    })

    // 异步更新和触发
    return new Promise((resolve, reject) => {
      clearTimeout(this.__isUpdating)
      this.__isUpdating = setTimeout(() => {
        const updating = this.__update
        this.__update = []

        // 去除已经存在的
        const table = {}
        updating.forEach((item, i) => {
          table[item.key] = i
        })

        const indexes = Object.values(table)
        const items = indexes.map(i => updating[i])

        // 先进行数据检查
        for (let i = 0, len = items.length; i < len; i ++) {
          let item = items[i]
          let { key, value } = item
          let def = definition[key]
          let info = { key, value, pattern: def, model: this, level: 'model', action: 'update' }

          if (isInstanceOf(def, Schema)) {
            let type = def.type
            let error = type.catch(value)
            if (error) {
              error = makeError(error, info)
              reject(error)
              return
            }
          }
          else if (isArray(def) && isInstanceOf(def[0], Schema)) {
            let [schema] = def
            let type = schema.type
            let SchemaType = new List([type])
            let error = SchemaType.catch(value)
            if (error) {
              error = makeError(error, info)
              reject(error)
              return
            }
          }
          else if (def && typeof def === 'object' && inObject('default', def) && inObject('type', def)) {
            let { type } = def
            let error = isInstanceOf(type, Type) ? type.catch(value) : isInstanceOf(type, Rule) ? type.validate2(value, key, target) : Tx.catch(value).by(type)
            if (error) {
              error = makeError(error, info)
              reject(error)
              return
            }
          }
          else {
            let error = new TySheMoError(`schema.definition.${key} type error.`)
            reject(error)
            return
          }
        }

        // 检查完数据再塞值
        items.forEach(({ key, value }) => assign(this.state, key, value))
        this.digest()
        resolve(this.state)
      })
    })
  }

  // 用新数据覆盖原始数据，使用 schema 的 prepare 函数获得需要覆盖的数据
  // 如果一个数据不存在于新数据中，将使用默认值
  reset(data) {
    const definition = this.definition
    const keys = Object.keys(definition)
    const coming = {}

    keys.forEach((key) => {
      const def = definition[key]
      if (isObject(def) && inObject('default', def) && inObject('type', def) && isFunction(def.prepare)) {
        const { prepare } = def
        coming[key] = prepare.call(this, data)
        return
      }
      coming[key] = data[key]
    })

    let next = this.schema.ensure(coming)
    this.state = next
    this.digest()

    this.schema.catch((errors) => {
      this.__catch = errors
    })

    return next
  }

  catch(fn) {
    setTimeout(() => {
      const noise = this.__catch
      if (noise && noise.length) {
        fn(noise)
      }
      this.__catch = []
    })
  }

  /**
   * 获取数据，获取数据之前，一定要先校验一次，以防获取中报错
   * @param {*} mode
   * 1: 获取经过map之后的数据
   * 2: 在1的基础上获取扁平化数据
   * 3: 在2的基础上转化为 FormData
   * 0: 获取原始数据
   */
  data(mode = 0) {
    // FormData
    if (mode >= 3) {
      const data = this.data(2)
      const formdata = new FormData()
      const formkeys = Object.keys(data)

      formkeys.forEach((key) => {
        formdata.append(key, data[key])
      })

      return formdata
    }
    // flat key extracted data
    else if (mode >= 2) {
      const data = this.data(1)
      const output = flatObject(data)
      return output
    }
    // extracted data
    else if (mode >= 1) {
      const data = this.state
      const definition = this.definition

      const extract = (data, definition) => {
        const keys = Object.keys(definition)
        const output = {}

        keys.forEach((key) => {
          const def = definition[key]
          var value = data[key]

          if (isInstanceOf(def, Schema)) {
            value = isObject(value) ? extract(value, def.definition) : def.ensure()
            assign(output, key, value)
            return
          }
          else if (isArray(def) && isInstanceOf(def[0], Schema)) {
            let [schema] = def
            value = isArray(value) ? value.map(item => extract(item, schema.definition)) : []
            assign(output, key, value)
            return
          }
          else if (def && typeof def === 'object' && inObject('default', def) && inObject('type', def)) {
            const { flat, drop, map, type } = def

            // type is inherited from Model, it means type is a Model too
            // we will use the true data of this model to output
            if (isInstanceOf(type.prototype, Model)) {
              value = isInstanceOf(value, Model) ? value.data() : (new type()).schema.ensure()
            }

            if (isFunction(flat)) {
              let mapping = flat.call(this, value)
              let mappingKeys = Object.keys(mapping)
              mappingKeys.forEach((key) => {
                let value = mapping[key]
                assign(output, key, value)
              })
            }

            if (isFunction(drop) && drop.call(this, value)) {
              return
            }
            else if (isBoolean(drop) && drop) {
              return
            }

            if (isFunction(map)) {
              let v = map.call(this, value)
              assign(output, key, v)
            }
          }
        })

        return output
      }

      const output = extract(data, definition)
      return output
    }
    // original data
    else {
      return this.state
    }
  }

  validate() {
    const schema = this.schema
    const data = this.state
    const error = schema.validate(data)
    if (error) {
      const info = { value: data, pattern: schema, model: this, level: 'model', action: 'validate' }
      return makeError(error, info)
    }

    const definition = this.definition
    const keys = Object.keys(definition)
    for (let i = 0, len = keys.length; i < len; i ++) {
      const key = keys[i]
      const def = definition[key]
      const value = data[key]
      if (def && typeof def === 'object' && inObject('default', def) && inObject('type', def) && isArray(def.validators)) {
        const { validators } = def
        for (let i = 0, len = validators.length; i < len; i ++) {
          const item = validators[i]

          if (!isObject(item)) {
            continue
          }

          const { determine, validate, message } = item

          let shouldValidate = false
          if (isFunction(determine) && determine.call(this, value)) {
            shouldValidate = true
          }
          else if (isBoolean(determine) && determine) {
            shouldValidate = true
          }
          if (!shouldValidate) {
            continue
          }

          let res = validate.call(this, value)
          let info = { value, key, pattern: new Rule(validate.bind(this)), model: this, level: 'model', action: 'validate' }
          let msg = isFunction(message) ? message.call(this, value) : message
          let error = isInstanceOf(res, Error) ? makeError(res, info) : !res ? new TySheMoError(msg, info) : null
          if (error) {
            return error
          }
        }
      }
    }
  }
}

export default Model
