import Parser from './ty/parser.js'
import Model from './model.js'
import ScopeX from 'scopex'
import {
  clone,
  each,
  isUndefined,
  isString,
  isFunction,
  isArray,
  inObject,
  isObject,
  isInstanceOf,
  isEmpty,
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

    const createFn = (scopex, exp, params, _attr) => (...args) => {
      const { data } = scopex
      const locals = {}
      params.forEach((param, i) => {
        if (inObject(param, data)) {
          throw new Error(`"${param}" has been declared in model, should not be declared again in "${_attr}"!`)
        }
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

    class ParsedModel extends Model {
      state() {
        return clone(state)
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
              exp.forEach((validator) => {
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
                    const value = createFn(scopex, exp, params, attr)
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
                const value = createFn(scopex, exp, params, attr)
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

            meta[key] = exp
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
        ParsedModel.prototype[key] = exp
        return
      }

      if (!isString(exp)) {
        return
      }

      ParsedModel.prototype[key] = function(...args) {
        const scopex = new ScopeX(this)
        const res = createFn(scopex, exp, params, attr)(...args)
        return res
      }
    })

    return ParsedModel
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

  fetchJSON(url) {
    return fetch(url).then(res => res.json())
  }
  load(url) {
    return this.fetchJSON(url).then(json => this.parse(json))
  }

  static getModelAsync(url) {
    const Constructor = this
    return new Constructor().load(url)
  }
}
export default Loader
