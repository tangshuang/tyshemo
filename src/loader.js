import Parser from './ty/parser.js'
import Model from './model.js'
import { createAsyncRef } from './shared/utils.js'
import ScopeX from 'scopex'
import Validator from './validator.js'
import {
  each,
  isUndefined,
  isString,
  isFunction,
  isArray,
  isObject,
  isInstanceOf,
  isEmpty,
  parse,
} from 'ts-fns'

export class Loader {
  /**
   *
   * @param {object} json {
   *   "schema": {
   *     "name": {
   *       "default": "",
   *       "type": "string",
   *       "required()": "age > 0",
   *     },
   *     "age": {
   *       "default": 0,
   *       "type": "number",
   *     },
   *   },
   *   "state": {
   *     "is_found": false
   *   },
   *   "attrs": {},
   *   "methods": {
   *     "doSome(v)": "name = v",
   *   },
   * }
   */
  parse(json) {
    const types = this.types()
    const defs = this.defs()
    const { schema, state = {}, attrs = {}, methods = {} } = json

    const loader = this
    const typeParser = new Parser(types)

    const createFn = (scopex, exp, params) => (...args) => {
      const locals = {}
      params.forEach((param, i) => {
        const value = args[i]
        locals[param] = value
      })

      const newScopex = scopex.$new(locals)
      const result = newScopex.parse(exp)
      return result
    }

    const parseAttr = (str) => {
      const matched = str.match(/([a-zA-Z0-9_$]+)(\((.*?)\))?/)
      if (!matched) {
        return [str]
      }

      const method = matched[1]
      if (!method) {
        return [str]
      }

      const m = matched[3]
      if (isUndefined(m)) {
        return [method]
      }

      // empty string, i.e. `required()`
      if (!m) {
        return [method, []]
      }

      const s = m || ''
      const none = void 0
      const params = s.split(',').map(item => item.trim() || none)

      return [method, params]
    }

    const parseDef = (key) => {
      return defs[key]
    }

    const parseAsyncSetter = (value) => {
      if (isString(value)) {
        const isAsyncSetter = /:fetch\(.*?\)/.test(value)
        if (isAsyncSetter) {
          const [_all, before, _matched, url, after] = value.match(/(.*?):fetch\((.*?)\)(.*?)/)
          const defaultValue = tryGetExp(before)
          return createAsyncRef(defaultValue, () => loader.fetch(url).then((data) => {
            if (data && typeof data === 'object' && after && after[0] === '.') {
              const keyPath = after.substr(1)
              return parse(data, keyPath)
            }
            else {
              return data
            }
          }))
        }
        else {
          return value
        }
      }
      else {
        return value
      }
    }

    class LoadedModel extends Model {
      state() {
        const stat = {}
        each(state, (value, key) => {
          stat[key] = parseAsyncSetter(value)
        })
        return stat
      }
      schema() {
        const scopex = new ScopeX(this)
        const $schema = {}
        each(schema, (def, field) => {
          // sub model(s)
          if (/^<.+?>$/.test(field)) {
            const name = field.substring(1, field.length - 1)

            const parse = (exp) => {
              if (isString(exp)) {
                const sub = parseDef(exp)
                if (sub && isInstanceOf(sub, Model)) {
                  return sub
                }
              }
              else if (exp && !isArray(exp) && typeof exp === 'object') {
                const sub = loader.parse(exp)
                return sub
              }
            }

            if (isArray(def)) {
              const items = def.map(item => parse(item)).filter(item => !!item)
              if (items.length) {
                $schema[name] = items
              }
            }
            else {
              const sub = parse(def)
              if (sub) {
                $schema[name] = sub
              }
            }

            return
          }

          if (!isObject(def)) {
            return
          }

          const meta = {}
          each(def, (_exp, attr) => {
            const [_key, _params] = parseAttr(attr)
            const [key, params, exp] = loader.meta(_key, _params, _exp)

            if (key === 'type') {
              const type = typeParser.parse(exp)
              meta.type = type
              return
            }

            if (key === 'validators') {
              if (!isArray(exp)) {
                return
              }
              const items = []
              const defaultValidators = new ScopeX(Validator)
              exp.forEach((validator, i) => {
                if (isString(validator)) {
                  // i.e. validators: [ "required('some is required!')" ]
                  const [key, params] = parseAttr(validator)
                  if (Validator[key] && params) {
                    items.push(defaultValidators.parse(validator))
                  }
                  return
                }

                if (!isObject(validator)) {
                  return
                }

                const item = {}
                each(validator, (_exp, attr) => {
                  const [_key, _params] = parseAttr(attr)
                  const [key, params, exp] = loader.validator(_key, _params, _exp)

                  if (isFunction(exp)) {
                    item[key] = exp
                    return
                  }

                  if (isArray(params)) {
                    const value = createFn(scopex, exp, params)
                    item[key] = value
                    return
                  }

                  item[key] = exp
                })
                items.push(item)
              })
              meta.validators = items
              return
            }

            // function attr
            /**
             * {
             *   "drop(v)": "v > 6 && age > 20"
             * }
             */
            if (isArray(params)) {
              if (!isString(exp)) { // not a string like: `"default()": {}`, it will be `default() { return {} }`
                meta[key] = () => exp
              }
              else {
                const value = createFn(scopex, exp, params)
                meta[key] = value
              }
              return
            }

            /**
             * {
             *   "default": "content text",
             *   "type": "string",
             *   "validators": [
             *     {
             *       "determine(value)": "value > 0"
             *       "validate(value)": "value > 5",
             *       "message": "should greater then 5"
             *     }
             *   ]
             * }
             */

            if (!isString(exp)) {
              meta[key] = exp
              return
            }

            const def = parseDef(exp)
            if (!isUndefined(def)) {
              meta[key] = def
              return
            }

            meta[key] = parseAsyncSetter(exp)
          })

          if (!isEmpty(meta)) {
            $schema[field] = meta
          }
        })

        return $schema
      }
      attrs() {
        const originalAttrs = super.attrs()
        return { ...originalAttrs, ...attrs }
      }
    }

    each(methods, (_exp, attr) => {
      if (!isString(_exp)) {
        return
      }

      const [_key, _params] = parseAttr(attr)
      if (!_params) {
        return
      }

      const [key, params, exp] = loader.method(_key, _params, _exp)

      if (isFunction(exp)) {
        LoadedModel.prototype[key] = exp
        return
      }

      if (!isString(exp)) {
        return
      }

      const isInjected = /await fetch\(.*?\)/.test(exp)
      const [_all, before, _matched, _url, after] = isInjected ? exp.match(/(.*)(await fetch\((.*?)\))(.*)/) : []

      LoadedModel.prototype[key] = function(...args) {
        const scopex = new ScopeX(this)
        if (isInjected) {
          return new Promise((resolve, reject) => {
            const url = createFn(scopex, _url, params)(...args)
            loader.fetch(url).then((data) => {
              const subScopex = scopex.$new({ __await__: data })
              const subExp = [before, '__await__', after].join('')
              const res = createFn(subScopex, subExp, params)(...args)
              resolve(res)
            }).catch(reject)
          })
        }

        const res = createFn(scopex, exp, params)(...args)
        return res
      }
    })

    return LoadedModel
  }

  types() {
    return {}
  }
  defs() {
    return {}
  }

  meta(key, params, exp) {
    return [key, params, exp]
  }
  validator(key, params, exp) {
    return [key, params, exp]
  }
  method(key, params, exp) {
    return [key, params, exp]
  }

  fetch(url) {
    return fetch(url).then(res => res.json())
  }

  load(url) {
    return this.fetch(url).then(json => this.parse(json))
  }

  static getModelAsync(url) {
    const Constructor = this
    return new Constructor().load(url)
  }
}
export default Loader

function tryGetExp(exp) {
  try {
    return JSON.parse(exp)
  }
  catch (e) {
    const scopex = new ScopeX({})
    try {
      return scopex.parse(exp)
    }
    catch (e) {
      return exp
    }
  }
}