import Dict from './dict.js'
import List from './list.js'
import { isObject, isArray, isInstanceOf, clone, inObject } from './utils.js'
import Type from './type.js'
import TySheMoError, { makeError } from './error.js'
import Rule from './rule.js'

const makeTypeDef = (definition, _key_ = '') => {
  const keys = Object.keys(definition)
  const pattern = {}
  keys.forEach((key) => {
    const def = definition[key]
    const path = _key_ + '.' + key
    if (isInstanceOf(def, Schema)) {
      pattern[key] = makeTypeDef(def.definition, path)
    }
    else if (isArray(def) && isInstanceOf(def[0], Schema)) {
      const [schema] = def
      const type = makeTypeDef(schema.definition, path + '[]')
      pattern[key] = new List([type])
    }
    else if (def && typeof def === 'object' && inObject('default', def) && inObject('type', def)) {
      pattern[key] = def.type
    }
    else {
      throw new TySheMoError(`schema.definition${path} type error.`)
    }
  })
  return new Dict(pattern)
}

export class Schema {
  /**
   * 数据源相关信息
   * @param {object} definition
   * {
   *   // 字段名，值为一个配置
   *   object: {
   *     default: '', // 必填，默认值
   *     type: String, // 必填，数据类型 Pattern
   *   },
   *   // 使用一个 schema 实例作为值，schema 本身是有默认值的
   *   schema: SomeSchema,
   *   array: \[schema\],
   * }
   */
  constructor(definition) {
    this.definition = definition
    this.type = makeTypeDef(definition)
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
      let error = new TySheMoError(`schema validate data should be an object.`, info)
      return error
    }

    let error = this.type.catch(data)
    if (error) {
      error = makeError(error, info)
      return error
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
    const keys = Object.keys(definition)
    const output = {}

    // 清空上一次留下来的噪声
    this.__catch = []
    // 一分钟之后清空 noise 释放内存。因此，要 catch 必须在一分钟之内，最好是 ensure 一结束
    setTimeout(() => {
      this.__catch = []
    }, 60*1000)

    keys.forEach((key) => {
      const def = definition[key]
      const defaultValue = def.default
      const value = data[key]

      let comming = null

      if (isInstanceOf(def, Schema)) {
        comming = def.ensure(value)
        let noise = def.noise
        def.noise = []
        setTimeout(() => {
          if (noise.length) {
            let info = { key, value, pattern: def.type, schema: this, level: 'schema', action: 'ensure' }
            noise.forEach((error) => {
              error = makeError(error, info)
              this.__catch.push(error)
            })
          }
        })
      }
      else if (isArray(def) && isInstanceOf(def[0], Schema)) {
        const [schema] = def
        const info = { key, value, pattern: Array, schema: this, level: 'schema', action: 'ensure' }
        if (isArray(value)) {
          comming = value.map((item, i) => {
            let output = schema.ensure(item)
            let noise = schema.noise
            schema.noise = []
            setTimeout(() => {
              if (noise.length) {
                let info2 = { index: i, value, pattern: schema.type, schema: this, level: 'schema', action: 'ensure' }
                noise.forEach((error) => {
                  error = makeError(error, info2)
                  error = makeError(error, info)
                  this.__catch.push(error)
                })
              }
            })
            return output
          })
        }
        else {
          comming = []
          setTimeout(() => {
            let error = new TySheMoError(`{keyPath} should be an array for schema.`, info)
            this.__catch.push(error)
          })
        }
      }
      else if (def && typeof def === 'object' && inObject('default', def) && inObject('type', def)) {
        const { type } = def
        let error = isInstanceOf(type, Type) ? type.catch(value) : isInstanceOf(type, Rule) ? type.validate2(value, key, target) : Tx.catch(value).by(type)
        if (error) {
          comming = clone(defaultValue)
          setTimeout(() => {
            if (error) {
              let info = { key, value, pattern: type, schema: this, level: 'schema', action: 'ensure' }
              error = makeError(error, info)
              this.__catch.push(error)
            }
          })
        }
        else {
          comming = clone(value)
        }
      }

      output[key] = comming
    })

    return output
  }

  /**
   * 用于异步捕获 ensure 过程中判断的错误，在调用 ensure 之后使用
   * @param {*} fn
   */
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
