import { isObject, isArray, inObject, isInstanceOf, assign, parse, isEmpty, isFunction, isBoolean, flatObject, isEqual, isInheritedOf, clone, getInterface, map, each, extractObject } from './utils.js'
import TsmError, { makeError } from './error.js'
import List from './list.js'
import Rule from './rule.js'
import Schema from './schema.js'
import Type from './type.js'
import TySheMo from './tyshemo.js'

/**
 * 数据源相关信息
 * definition是一个对象
 *
 * {
 *   // 对象格式的配置
 *   key: {
 *
 *     // ---------------- schema ---------------
 *     type: String, // 必填，type 不能为 Model 及其继承者
 *       // 注意：default 和 compute 的结果必须符合 type 的要求，这一点必须靠开发者自己遵守，Model 内部没有进行控制
 *     default: '', // 必填，默认值
 *     validate,
 *     ensure,
 *     required,
 *
 *
 *     // ----------------- model ---------------
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
 *   // 某个 Model
 *   key2: SomeModel,
 *   // 某个 Model 的数组
 *   key3: \[SomeModel\]
 * }
 *
 * 需要注意：只有definition中规定的属性会被当作model最终生成formdata的字段，不在definition中规定的，但是仍然存在于model中的属性不会被加入到formdata中。
 * 当然，即使在definition中，但加了drop的也可能被排除出去。抑或，不在definition中，但flat和patch的新属性也会被加入到formdata结果中。
 *
 * 当一个属性的值为一个新的FormModel，或者为一个包含了FormModel的数组时，在生成最终的formdata的时候，会从这些FormModel中提取出真正的结果。
 */

export class Model {
  constructor(data = {}) {
    const Interface = getInterface(this)

    if (!isInheritedOf(Interface, Model)) {
      throw new Error('Model should be extended.')
    }

    const definition = Interface.schema

    if (!isObject(definition)) {
      throw new TsmError('model schema should be an object.')
    }

    each(definition, (def, key) => {
      if (isObject(def)) {
        if (!inObject('default', def)) {
          throw new TsmError(`[Model]: '${key}' should have 'default' property.`)
        }
        if (!inObject('type', def)) {
          throw new TsmError(`[Model]: '${key}' should have 'type' property.`)
        }
        if (def.type === Model || isInheritedOf(def.type, Model)) {
          throw new TsmError(`[Model]: '${key}.type' should not be model, use model as a property value directly.`)
        }
      }
      else if (isArray(def)) {
        if (def.length !== 1) {
          throw new TsmError(`[Model]: '${key}' should have only one item in array.`)
        }
        if (!isInstanceOf(def[0], Model)) {
          throw new TsmError(`[Model]: '${key}' should be a model array.`)
        }
      }
      else if (!isInstanceOf(def, Model)) {
        throw new TsmError(`[Model]: '${key}' should be a model, a model array or an model definition object.`)
      }
    })

    this.definition = definition

    this.state = {}
    this.reset(data)

    this.__listeners = {}
    this.__update = []
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
    const listener = this.__listeners[keyPath]
    if (!listener) {
      this.__listeners[keyPath] = {
        keyPath,
        value: null,
        callbacks: [],
      }
      listener = this.__listeners[keyPath]
    }

    listener.value = clone(value)
    listener.callbacks.push({ fn, deep })
    return this
  }

  unwatch(keyPath, fn) {
    const listener = this.__listeners[keyPath]
    const { callbacks } = listener
    callbacks.forEach((item, i) => {
      if (item.fn === fn || fn === undefined) {
        callbacks.splice(i, 1)
      }
    })
    return this
  }

  digest() {
    const listeners = Object.values(this.__listeners)
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
        throw new TsmError(`digest over 15 times.`)
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
          let error = this.validate()
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

        // 去重
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

          let error = null
          if (isObject(def)) {
            const { type } = def
            error = TySheMo.catch(value).by(type)
          }
          else if (isArray(def)) {
            const [model] = def
            for (let i = 0, len = value.length; i < len; i ++) {
              const item = value[i]
              error = TySheMo.catch(item).by(model)
              if (error) {
                break
              }
            }
          }
          else if (isInheritedOf(def)) {
            error = TySheMo.catch(value).by(def)
          }

          if (error) {
            error = makeError(error, info)
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


  /**
   * 获取数据，获取数据之前，一定要先校验一次，以防获取中报错
   * @param {*} mode
   * 1: 将内部的子 Model 提取值，而非以 model 形式返回
   * 2: 获取经过map之后的数据
   * 3: 在1的基础上获取扁平化数据
   * 4: 在2的基础上转化为 FormData
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
        const output = {}

        each(definition, (def, key) => {
          const value = data[key]

          if (isObject(def)) {
            const { flat, drop, map } = def

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

            const v = isFunction(map) ? map.call(this, value) : value
            assign(output, key, v)
          }
          else if (isArray(def)) {
            const [model] = def
            const v = isArray(value) ? value.map(item => isInstanceOf(item, model) ? item.data(2) : null) : []
            assign(output, key, v)
          }
          else if (isInheritedOf(def, Model)) {
            const v = isInstanceOf(value, def) ? value.data(2) : null
            assign(output, key, v)
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

  /**
   * 对当前 state 进行校验
   */
  validate() {
    const extract = (model) => {
      const state = model.state
      const data = map(state, (value) => {
        if (isInstanceOf(value, Model)) {
          return extract(value)
        }
        else {
          return value
        }
      })
      return data
    }
    const data = extract(this)

    // 重新整理 schema 使之在调用时按照正确的方式进行调用
    const schema = new Schema(map(definition, (def) => {
      if (isObject(def)) {
        return extractObject(def, ['type', 'default', 'validate', 'ensure', 'required'])
      }
    }))
    /////// TODO: ////////////////////


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

      if (isObject(def)) {
        const { validators } = def
        const info = { value, key, model: this, level: 'model', action: 'validate' }

        if (!isArray(validators)) {
          continue
        }

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
          let info2 = { ...info, pattern: new Rule(validate.bind(this)) }
          let msg = isFunction(message) ? message.call(this, value) : message
          let error = isInstanceOf(res, Error) ? makeError(res, info2) : !res ? new TsmError(msg, info2) : null
          if (error) {
            return error
          }
        }
      }
    }
  }


  // 用新数据覆盖原始数据，使用 schema 的 prepare 函数获得需要覆盖的数据
  // 如果一个数据不存在于新数据中，将使用默认值
  reset(data) {
    if (!isObject(data)) {
      data = {}
    }

    const definition = this.definition
    const coming = {}

    each(definition, (def, key) => {
      const value = data[key]

      if (isObject(def)) {
        const { prepare } = def
        let v = null
        if (isFunction(prepare)) {
          try {
            v = prepare.call(this, data)
          }
          catch (e) {
            v = value
          }
        }
        else {
          v = value
        }
        coming[key] = v
      }
    })

    const schema = this.schema
    const next = schema.ensure(coming)

    each(definition, (def, key) => {
      const value = next[key]
      if (isArray(def)) {
        const [model] = def
        const v = value.map((item) => {
          const ins = new model()
          ins.state = item
          return ins
        })
        next[key] = v
      }
      else if (isObject(def)) {
        const v = new model()
        v.state = value
        next[key] = v
      }
    })

    this.state = next
    this.digest()

    return this
  }

}

export default Model
