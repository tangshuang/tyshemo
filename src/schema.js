
import { isObject, isArray, isInstanceOf, clone, inObject, each, isFunction, getInterface } from './utils.js'
import TsmError, { makeError } from './error.js'
import TySheMo from './tyshemo.js'

export class Schema {
  /**
   * 数据源相关信息
   * @param {object} definition
   * {
   *   // 字段名，值为一个配置对象
   *   object: {
   *     default: '', // 必填，默认值，注意：默认值必须符合该字段的类型和校验规则
   *     type: String, // 必填，数据类型，不能为 Schema 及其实例
   *     validate: value => true|false, // 选填，对值进行特殊校验，例如对数字的值域进行校验
   *     ensure: value => newValue, // 选填，在 ensure 的时候，对当前字段值进行转化，将转化结果返回，注意，转化结果不会再进行校验
   *     required: false, // 选填，默认为 true，为 false 的时候，表示这个字段是可选的，可以不存在，而类型检查和校验，只会在该字段存在时使用
   *   },
   *   // 使用一个 schema 实例作为值，schema 本身是有默认值的
   *   schema: SomeSchema,
   *   // 使用一个 schema 数组作为值，表示这个属性必须是一个数组，且数组中的每一个元素都是一个 schema 结构。这里的数组必须只有一个元素。
   *   schemaarray: \[SomeSchema\],
   * }
   */
  constructor(definition) {
    // Schema 不允许被继承
    if (getInterface(this) !== Schema) {
      throw new TsmError(`Schema can not be extended.`)
    }

    // 校验定义信息是否符合规则
    // 经过实例化校验之后，后续的方法中都不用担心对应的类型问题
    each(definition, (def, key) => {
      if (isObject(def)) {
        if (!inObject('default', def)) {
          throw new TsmError(`[Schema]: '${key}' should have 'default' property.`)
        }
        if (!inObject('type', def)) {
          throw new TsmError(`[Schema]: '${key}' should have 'type' property.`)
        }
        // 对象定义时，不能使用 schema 作为 type，要使用 schema 直接传即可
        if (isInstanceOf(def.type, Schema)) {
          throw new TsmError(`[Schema]: '${key}.type' should not be schema, use schema as a property value directly.`)
        }
      }
      else if (isArray(def)) {
        if (def.length !== 1) {
          throw new TsmError(`[Schema]: '${key}' should have only one item in array.`)
        }
        if (!isInstanceOf(def[0], Schema)) {
          throw new TsmError(`[Schema]: '${key}' should be a schema array.`)
        }
      }
      else if (!isInstanceOf(def, Schema)) {
        throw new TsmError(`[Schema]: '${key}' should be a schema, a schema array or an schema definition object.`)
      }
    })

    this.definition = definition
    this.name = 'Schema'
  }

  /**
   * 断言给的值是否符合 schema 的要求
   * @todo 由于Schema是不会发生变化的，因此可以使用纯函数缓存功能
   * @param {*} data
   */
  validate(data) {
    const info = { value: data, schema: this, level: 'schema', action: 'validate' }
    if (!isObject(data)) {
      let error = new TsmError(`schema validate data should be an object.`, info)
      return error
    }

    const definition = this.definition
    const keys = Object.keys(definition)
    for (let i = 0, len = keys.length; i < len; i ++) {
      const key = keys[i]
      const def = definition[key]
      const value = data[key]
      let error
      // 因为在实例化的时候，已经对 definition 进行过检查，因此，它的格式一定不会是错的
      if (isObject(def)) {
        const { type, validate, required } = def
        // 必填检查
        if (required !== false && !inObject(key, data)) {
          error = new TsmError(`{keyPath} should must exist.`)
        }
        // 只要存在，就会进行校验
        else if (inObject(key, data)) {
          // 先检查类型
          error = TySheMo.catch(value).by(type)
          // 再执行校验器
          if (!error && isFunction(validate)) {
            error = validate(value) // 对于更高层的 Model，可以在 validate 里面做文章
          }
        }
      }
      else if (isArray(def)) {
        if (!isArray(value)) {
          error = new TsmError(`{keyPath} should be an array.`)
        }
        else {
          const [schema] = def
          error = schema.validate(value)
        }
      }
      else if (isInstanceOf(def, Schema)) {
        error = def.validate(value)
      }
      if (error) {
        error = makeError(error, info)
        return error
      }
    }
  }

  /**
   * 通过传入的数据定制符合 schema 的输出数据
   * @todo 由于 Schema 是不会发生变化的，因此可以使用纯函数缓存功能
   * @param {*} data
   */
  ensure(data) {
    if (!isObject(data)) {
      data = {}
    }

    const definition = this.definition
    const output = {}
    let comming = null

    each(definition, (def, key) => {
      const value = data[key]

      if (isObject(def)) {
        const { type, validate, ensure } = def
        const defaultValue = def.default

        if (!inObject(key, data)) {
          comming = clone(defaultValue)
        }
        else if (!TySheMo.test(value).by(type)) {
          comming = clone(defaultValue)
        }
        else if (isFunction(validate) && !validate(value)) {
          comming = clone(defaultValue)
        }
        else {
          comming = clone(value)
        }

        if (isFunction(ensure)) {
          comming = ensure(comming) // 对于更高层的 Model 可以将值提取放到 ensure 中
        }
      }
      else if (isArray(def)) {
        const [schema] = def

        if (!isArray(value)) {
          comming = clone(defaultValue)
        }
        else {
          comming = value.map(item => schema.ensure(item))
        }
      }
      else if (isInstanceOf(def, Schema)) {
        comming = def.ensure(value)
      }

      output[key] = comming
    })

    return output
  }

  /**
   * 在原来的基础上进行扩展。
   * 需要注意的是，如果传入的 field 在原来中存在，会使用传入的 field 配置全量覆盖原来的。
   * @param {*} fields
   */
  extend(fields) {
    const definition = this.definition
    const next = { ...definition, fields }
    const schema = new Schema(next)
    return schema
  }

  /**
   * 从原来的基础上选出部分
   * @param {*} fields
   */
  extract(fields) {
    const definition = this.definition
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        let pattern = definition[key]
        next[key] = pattern
      }
    })

    const schema = new Schema(next)
    return schema
  }

  /**
   * 混合模式，值为 true 时直接挑选，为 object 时使用该 object 作为值
   * @param {*} fields
   */
  mix(fields) {
    const definition = this.definition
    const keys = Object.keys(fields)
    const next = {}

    keys.forEach((key) => {
      if (fields[key] === true) {
        next[key] = definition[key]
      }
      else if (isObject(fields[key])) {
        next[key] = fields[key]
      }
    })

    const schema = new Schema(next)
    return schema
  }

}

export default Schema
