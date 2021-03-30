import Parser from './ty/parser.js'
import Model from './model.js'
import { createAsyncRef } from './shared/utils.js'
import ScopeX from 'scopex'
import Validator from './validator.js'
import Factory from './factory.js'
import {
  each,
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
    const filters = this.filters()
    const { schema, state = {}, attrs = {}, methods = {} } = json

    const loader = this
    const typeParser = new Parser(types)

    let hasDefUsed = false
    const defProxy = new Proxy(defs, {
      get(target, key, receiver) {
        if (key in defs) {
          hasDefUsed = true
        }
        return Reflect.get(target, key, receiver)
      },
    })

    const defScopex = new ScopeX(defProxy, { loose: true, filters })

    const parseExp = (exp, scopex = defScopex) => {
      if (!exp) {
        return
      }
      if (!isString(exp)) {
        return
      }

      try {
        const value = scopex.parse(exp)
        const hasUsed = hasDefUsed
        hasDefUsed = false
        return hasUsed ? { value } : null
      }
      catch (e) {
        hasDefUsed = false
      }
    }

    const createFn = (scopex, exp, params) => (...args) => {
      const locals = {}
      params.forEach((param, i) => {
        const value = args[i]
        locals[param] = value
      })

      const newDefScopex = defScopex.$new(locals)
      const res = parseExp(exp, newDefScopex)
      if (res) {
        return res.value
      }

      const newScopex = scopex.$new(locals)
      const output = newScopex.parse(exp)
      return output
    }

    const parseKey = (str) => {
      const matched = str.match(/([a-zA-Z0-9_$]+)(\((.*?)\))?(!(.*))?/)
      const [_, name, _p, _params, _m, _macro] = matched
      const params = isString(_params) ? _params.split(',').map(item => item.trim()).filter(item => !!item) : void 0
      const macro = _m ? _macro || '' : void 0
      return [name, params, macro]
    }

    const parseGetter = (value) => {
      if (isString(value)) {
        if (/:fetch\(.*?\)/.test(value)) {
          const [_all, before, _matched, matched, after] = value.match(/(.*?):fetch\((.*?)\)(.*?)/)
          const defaultValue = tryGetExp(before)
          return createAsyncRef(defaultValue, () => {
            return loader.fetch(matched).then((data) => {
              if (data && typeof data === 'object' && after && after[0] === '.') {
                const keyPath = after.substr(1)
                return parse(data, keyPath)
              }
              else {
                return data
              }
            })
          })
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
          stat[key] = parseGetter(value)
        })
        return stat
      }
      schema() {
        const scopex = new ScopeX(this, { loose: true, filters })
        const $schema = {}
        const factories = {}

        each(schema, (def, field) => {
          // sub model(s)
          if (/^<.+?>$/.test(field)) {
            const name = field.substring(1, field.length - 1)

            const parse = (exp) => {
              if (isString(exp)) {
                const res = parseExp(exp)
                if (res && isInstanceOf(res.value, Model)) {
                  return res.value
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
            const [_key, _params] = parseKey(attr)
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

              const defaultValidators = new ScopeX(Validator, { filters })
              exp.forEach((validator, i) => {
                if (isString(validator)) {
                  // i.e. validators: [ "required('some is required!')" ]
                  const [key, params] = parseKey(validator)
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
                  const [_key, _params] = parseKey(attr)
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

            const res = parseExp(exp)
            if (res) {
              meta[key] = res.value
              return
            }

            meta[key] = parseGetter(exp)
          })

          // |submodel| sub model(s) factory, should must be used with <submodel>
          if (/^\|.+?\|$/.test(field)) {
            const name = field.substring(1, field.length - 1)
            factories[name] = meta
            return
          }

          if (!isEmpty(meta)) {
            $schema[field] = meta
          }
        })

        // factory wrapper should must come after schema finished, or schema sub model will not be ready
        each(factories, (fac, name) => {
          if (!$schema[name]) {
            return
          }
          if (!isObject(fac)) {
            return
          }
          $schema[name] = new Factory($schema[name], fac)
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

      const [_key, _params] = parseKey(attr)
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
        const scopex = new ScopeX(this, { loose: true, filters })

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
  filters() {
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
