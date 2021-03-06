import Parser from './ty/parser.js'
import Model from './model.js'
import { createAsyncRef } from './shared/utils.js'
import { ScopeX, createScope } from 'scopex'
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
  constructor(options = {}) {
    const { global: globalVars = {}, filters: thisFilters = {} } = options
    const defs = this.defs()
    const filters = this.filters()
    this.globalScope = createScope({ ...globalVars, ...defs }, {
      filters: {
        ...thisFilters,
        ...filters,
      },
    })

    const types = this.types()
    this.typeParser = new Parser(types)
  }
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
    const loader = this
    const { globalScope, typeParser } = this

    const { schema, state = {}, attrs = {}, methods = {} } = json

    const getFinalExp = (exp) => exp.trim()
      .replace(/^\.\./g, '$views.') // -> { ..a.value }
      .replace(/(\s)\.\./g, ' $views.') // -> { a + ..b.value }
      .replace(/(.)\.\./g, '$1.$views.') // -> { $parent..b.value }

    const parseKey = (str) => {
      const matched = str.match(/([a-zA-Z0-9_$]+)(\((.*?)\))?/)
      const [_, name, _p, _params] = matched
      const params = isString(_params) ? _params.split(',').map(item => item.trim()).filter(item => !!item) : void 0
      return [name, params]
    }

    const isInlineExp = (str) => {
      return str[0] === '{' && str[str.length - 1] === '}'
    }

    const getInlineExp = (str) => {
      return str.substring(1, str.length - 1).trim()
    }

    const getExp = (str) => {
      const line = isInlineExp(str) ? getInlineExp(str) : str
      const exp = getFinalExp(line)
      return exp
    }

    const tryGetRealValue = (exp) => {
      try {
        return JSON.parse(exp)
      }
      catch (e) {
        const scope = new ScopeX({})
        try {
          return scope.parse(exp)
        }
        catch (e) {
          return exp
        }
      }
    }

    const tryGetInScope = (exp, scope = globalScope) => {
      try {
        let isIn = false
        const res = scope.parse(exp, deps => isIn = !!deps.length)
        return [isIn, res]
      }
      catch (e) {
        return []
      }
    }

    const parseGetter = (value) => {
      if (isString(value)) {
        if (/:fetch\(.*?\)/.test(value)) {
          const [_all, before, _matched, matched, after] = value.match(/(.*?):fetch\((.*?)\)(.*?)/)
          const defaultValue = tryGetRealValue(before)
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
      }
      return value
    }

    const parseSubModel = (exp) => {
      // if string, only support inline exp
      if (isString(exp) && isInlineExp(exp)) {
        const [isIn, res] = tryGetInScope(getInlineExp(exp))
        if (isIn && res && isInstanceOf(res, Model)) {
          return res
        }
      }
      else if (exp && !isArray(exp) && typeof exp === 'object') {
        const sub = loader.parse(exp)
        return sub
      }
    }

    const createFn = (scope, exp, params) => (...args) => {
      if (!params) {
        const output = scope.parse(exp)
        return output
      }

      const locals = {}
      params.forEach((param, i) => {
        const value = args[i]
        locals[param] = value
      })

      const newScope = scope.$new(locals)
      const output = newScope.parse(exp)
      return output
    }

    const createValue = (scope, value, params) => {
      // not a string like: `"default()": {}`, it will be `default() { return {} }`
      if (!isString(value)) {
        return params ? (() => value) : value
      }

      const isInline = isInlineExp(value)
      if (!params && !isInline) {
        return parseGetter(value)
      }

      const line = isInline ? getInlineExp(value) : value
      const exp = getFinalExp(line)

      const getter = parseGetter(exp)
      if (getter !== exp) {
        return getter
      }

      // only inline exp
      // { "some": "{ field }" }
      if (!params && isInline) {
        return createFn(scope, exp, [])
      }

      // function attr
      /**
       * {
       *   "drop(v)": "v > 6 && age > 20"
       * }
       */

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

      return createFn(scope, exp, params)
    }

    class LoadedModel extends Model {
      state() {
        const stat = {}
        each(state, (value, key) => {
          stat[key] = parseGetter(value)
        })
        return stat
      }
      attrs() {
        const originalAttrs = super.attrs()
        return { ...originalAttrs, ...attrs }
      }
      schema() {
        const scope = globalScope.$new(this)
        const metas = {}
        const submodels = {}
        const factories = {}

        each(schema, (def, field) => {
          // sub model(s)
          if (/^<.+?>$/.test(field)) {
            const name = field.substring(1, field.length - 1)

            if (isArray(def)) {
              const items = def.map(item => parseSubModel(item)).filter(item => !!item)
              if (items.length) {
                submodels[name] = items
              }
            }
            else {
              const sub = parseSubModel(def)
              if (sub) {
                submodels[name] = sub
              }
            }

            return
          }

          if (!isObject(def)) {
            return
          }

          const meta = {}
          const defi = loader.meta(def)
          each(defi, (_exp, attr) => {
            const [_key, _params] = parseKey(attr)
            const [key, params, exp] = loader.attr(_key, _params, _exp)

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
              const builtinValidators = globalScope.$new(Validator)
              exp.forEach((validator) => {
                if (isString(validator)) {
                  // i.e. validators: [ "required('some is required!')" ]
                  const [key, params] = parseKey(validator)
                  if (Validator[key] && params) {
                    items.push(builtinValidators.parse(validator))
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

                  item[key] = createValue(scope, exp, params)
                })
                items.push(item)
              })
              meta.validators = items
              return
            }

            meta[key] = createValue(scope, exp, params)
          })

          // DEPARTED Compatible for old version
          // |submodel| sub model(s) factory, should must be used with <submodel>
          if (/^\|.+?\|$/.test(field)) {
            const key = field.substring(1, field.length - 1)
            factories[key] = meta
            return
          }

          if (!isEmpty(meta)) {
            metas[field] = meta
          }
        })

        // factory wrapper should must come after schema finished, or schema sub model will not be ready
        each(submodels, (model, field) => {
          const attrs = factories[field] || metas[field] // -> new version support submodel field name directly
          if (attrs) {
            metas[field] = Factory.getMeta(model, attrs)
          }
          else {
            metas[field] = model
          }
        })

        return metas
      }
    }

    each(methods, (value, attr) => {
      if (!isString(value)) {
        return
      }

      const [_key, _params] = parseKey(attr)
      if (!_params) {
        return
      }

      const _exp = getExp(value)
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
        const scope = globalScope.$new(this)

        if (isInjected) {
          return new Promise((resolve, reject) => {
            const url = createFn(scope, _url, params)(...args)
            loader.fetch(url).then((data) => {
              const subScope = scope.$new({ __await__: data })
              const subExp = [before, '__await__', after].join('')
              const res = createFn(subScope, subExp, params)(...args)
              resolve(res)
            }).catch(reject)
          })
        }

        const res = createFn(scope, exp, params)(...args)
        return res
      }
    })

    return this.extend(LoadedModel) || LoadedModel
  }

  // set types
  types() {
    return {}
  }
  // set defs
  defs() {
    return {}
  }
  // global vars
  global() {
    return {}
  }
  // set filters
  filters() {
    return {}
  }

  // you can modify json meta object here
  meta(meta) {
    return meta
  }
  // you can modify an attribute json here
  attr(key, params, exp) {
    return [key, params, exp]
  }
  // you can modify an validator json here
  validator(key, params, exp) {
    return [key, params, exp]
  }
  // you can modify a method json here
  method(key, params, exp) {
    return [key, params, exp]
  }

  // extend LoadedModel
  extend(Model) {
    return Model
  }

  // define fetch factory
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
