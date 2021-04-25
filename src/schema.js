import {
  isObject,
  isArray,
  isFunction,
  isBoolean,
  isInstanceOf,
  each,
  clone,
  define,
  isString,
  isNumber,
  isUndefined,
  interpolate,
  inObject,
  isInheritedOf,
  isEmpty,
  isNone,
} from 'ts-fns'

import { Ty, Rule } from './ty/index.js'
import Meta from './meta.js'
import { patchObj } from './shared/utils.js'

export class Schema {
  constructor(metas) {
    each(metas, (meta, key) => {
      if (!meta) {
        return
      }

      // only metas will be used
      const value = isInstanceOf(meta, Meta) ? meta
        : isInheritedOf(meta, Meta) ? new meta()
        : null

      if (!value) {
        return
      }

      define(this, key, {
        value,
        enumerable: true,
      })
    })
  }

  has(key) {
    return !!this[key]
  }

  /**
   * get default value by using `default` option
   * @param {*} key
   */
  getDefault(key, context) {
    const meta = this[key]
    const { default: defaultValue } = meta
    if (isFunction(defaultValue)) {
      return defaultValue.call(context, key)
    }
    else if (isObject(defaultValue) || isArray(defaultValue)) {
      return clone(defaultValue)
    }
    else {
      return defaultValue
    }
  }

  /**
   * get message for some attr
   * @param {*} key
   * @param {*} attr
   * @param {*} context
   */
  $message(key, attr, context) {
    return (givenMessage) => {
      const meta = this[key]

      if (!meta) {
        return ''
      }

      const node = meta[attr]

      if (!node) {
        return ''
      }

      const defualtMessage = interpolate(Schema.defualtMessages[attr] || `{key} ${attr} error.`, { key })
      const { catch: handle } = meta

      let finalMessage = defualtMessage

      if (isString(givenMessage)) {
        finalMessage = givenMessage
      }
      // required: true
      else if (isBoolean(node)) {
        finalMessage = defualtMessage
      }
      // required: 'should be required.'
      else if (isString(node)) {
        finalMessage = node
      }
      // required() { return true }, function to return boolean
      else if (isFunction(node)) {
        finalMessage = defualtMessage
      }
      // required: { ... }
      else if (isObject(node) && node.message) {
        const { message } = node
        // required: { message() { return 'xxx' } }
        if (isFunction(message)) {
          finalMessage = this._trydo(
            () => message.call(context, attr, key),
            (error) => isFunction(handle) && handle.call(context, error, key) || defualtMessage,
            {
              key,
              attr: 'message',
            },
          )
        }
        // required: { message: 'required' }
        else if (isString(message)) {
          finalMessage = message
        }
      }

      // interpolate the inner message
      finalMessage = interpolate(finalMessage, meta)

      return finalMessage
    }
  }

  /**
   * get determine result for some attr
   * @param {*} key
   * @param {*} attr
   * @param {*} context
   */
  $decide(key, attr, context) {
    return (fallback) => {
      const meta = this[key]

      const callback = () => {
        return isFunction(fallback) ? fallback.call(context, key) : fallback
      }

      if (!meta) {
        return callback()
      }

      if (!inObject(attr, meta)) {
        return callback()
      }

      const node = meta[attr]
      const { catch: handle } = meta

      /**
       * node is a object like: {
       *   determine: true,
       *   message: '{key} should be required',
       * }
       */
      if (isObject(node)) {
        const { determine } = node
        if (isFunction(determine)) {
          return this._trydo(
            () => determine.call(context, key),
            (error) => isFunction(handle) && handle.call(context, error, key) || callback(),
            {
              key,
              attr,
            },
          )
        }
        else {
          return determine
        }
      }

      /**
       * node is a function, use as a getter
       */
      if (isFunction(node)) {
        return this._trydo(
          () => node.call(context, key),
          (error) => isFunction(handle) && handle.call(context, error, key) || fallback,
          {
            key,
            attr,
          },
        )
      }

      /**
       * node is a normal value
       */
      return node
    }
  }

  required(key, context) {
    return this.$decide(key, 'required', context)(false)
  }

  disabled(key, context) {
    return this.$decide(key, 'disabled', context)(false)
  }

  readonly(key, context) {
    return this.$decide(key, 'readonly', context)(false)
  }

  hidden(key, context) {
    return this.$decide(key, 'hidden', context)(false)
  }

  empty(key, value, context) {
    const meta = this[key]
    const { empty, catch: handle } = meta

    if (!empty) {
      return isEmpty(value)
    }

    return this._trydo(
      () => empty.call(context, value, key),
      (error) => isFunction(handle) && handle.call(context, error, key) || isEmpty(value),
      {
        key,
        attr: 'empty',
      },
    )
  }

  get(key, value, context) {
    const meta = this[key]

    if (!meta) {
      return value
    }

    const { getter, catch: handle } = meta

    if (isFunction(getter)) {
      const coming = this._trydo(
        () => getter.call(context, value, key),
        (error) => isFunction(handle) && handle.call(context, error, key) || value,
        {
          key,
          attr: 'getter',
        },
      )
      return coming
    }
    else {
      return value
    }
  }

  format(key, value, context) {
    const meta = this[key]

    if (!meta) {
      return value
    }

    const { formatter, catch: handle } = meta
    const text = isNone(value) ? '' : value

    if (isFunction(formatter)) {
      const coming = this._trydo(
        () => formatter.call(context, value, key),
        (error) => isFunction(handle) && handle.call(context, error, key) || text,
        {
          key,
          attr: 'formatter',
        },
      )
      return coming
    }
    else {
      return text
    }
  }

  /**
   * get new value by given value
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  $set(key, value, context) {
    const meta = this[key]

    if (!meta) {
      return value
    }

    const { setter, catch: handle } = meta

    if (isFunction(setter)) {
      value = this._trydo(
        () => setter.call(context, value, key),
        (error) => isFunction(handle) && handle.call(context, error, key) || value,
        {
          key,
          attr: 'setter',
        },
      )
    }

    return value
  }

  // type checking
  check(key, value, context) {
    const meta = this[key]

    if (!meta) {
      return
    }

    const { type, message } = meta

    if (!type) {
      return
    }

    const target = {}
    // make rule works
    if (!isUndefined(value)) {
      target[key] = value
    }

    const error = isInstanceOf(type, Rule) ? Ty.catch(target).by({ [key]: type }) : Ty.catch(value).by(type)
    if (error) {
      const e = {
        key,
        action: 'check',
        value,
        type: true,
        error,
        message: this.$message(key, 'type', context)(message),
      }
      this._catch(key, e, context)
      return error
    }
  }

  /**
   * get new value, with `disabled` `readonly` checking
   * @param {*} key
   * @param {*} next
   * @param {*} prev
   * @param {*} context
   */
  set(key, next, prev, context) {
    const meta = this[key]

    if (!meta) {
      return next
    }

    const disabled = this.disabled(key, context)
    if (disabled) {
      const e = {
        key,
        action: 'set',
        next,
        prev,
        disabled: true,
        message: this.$message(key, 'disabled', context)(disabled),
      }
      this._catch(key, e, context)
      return prev
    }

    const readonly = this.readonly(key, context)
    if (readonly) {
      const e = {
        key,
        action: 'set',
        next,
        prev,
        readonly: true,
        message: this.$message(key, 'readonly', context)(readonly),
      }
      this._catch(key, e, context)
      return prev
    }

    const value = this.$set(key, next, context)

    // run checking even though force=false, so that we can catch the error
    const error = this.check(key, value, context)
    if (meta.force && error) {
      return prev
    }

    return value
  }

  /**
   * create a function to only validate the rules which passed into validators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   * @returns {function}
   */
  $validate(key, value, context) {
    const meta = this[key]
    const { catch: handle, validators = [] } = meta

    const validate = (validator, index, dontTry) => {
      const { determine, validate, message } = validator

      if (isBoolean(determine) && !determine) {
        return
      }

      if (isFunction(determine)) {
        const bool = this._trydo(
          () => determine.call(context, value, key),
          (error) => isFunction(handle) && handle.call(context, error, key) || false,
          {
            key,
            attr: 'validators[' + index + '].determine',
          },
          dontTry,
        )
        if (!bool) {
          return
        }
      }

      const res = this._trydo(
        () => validate.call(context, value, key),
        (error) => isFunction(handle) && handle.call(context, error, key) || true,
        {
          key,
          attr: 'validators[' + index + '].validate',
        },
        dontTry,
      )

      // private: if the validate result is an array, it may the submodel return the validate error directly
      if (isArray(res)) {
        return res
      }

      // true, 'xxx', {}, 1, 2, 3... are allowed
      // if a dev want to use custom message, he can return an Error
      if (res && !isInstanceOf(res, Error)) {
        return
      }

      let msg = isString(message) ? message
        // if validate return an error, use error message as
        : isInstanceOf(res, Error) ? res.message
        : ''

      if (isFunction(message)) {
        msg = this._trydo(
          () => message.call(context, value, key, res),
          (error) => isFunction(handle) && handle.call(context, error, key) || msg || `${key} did not pass validators[${index}]`,
          {
            key,
            attr: 'validators[' + index + '].message',
          },
          dontTry,
        )
      }

      // interpolate with meta, so that we can provide more info
      msg = interpolate(msg, { key, value, ...meta })

      const error = {
        key,
        value,
        at: index,
        message: msg,
      }
      return error
    }

    const runOne = (dontTry, validators, i, errors) => {
      const validator = validators[i]
      if (!validator) {
        return
      }

      const { break: isBreak, async: isAsync } = validator
      // ignore async validators
      if (isAsync) {
        return
      }

      const error = validate(validator, i, dontTry)
      if (isArray(error)) {
        const errs = error.filter(item => !!item && typeof item === 'object' && item.message)
        errors.push(...errs)
        return isBreak
      }
      else if (error) {
        errors.push(error)
        return isBreak
      }
    }

    const validateByRange = (dontTry, validators, [start = 0, end = validators.length - 1]) => {
      const errors = []
      for (let i = start; i <= end; i ++) {
        const isBreak = runOne(dontTry, validators, i, errors)
        if (isBreak) {
          break
        }
      }
      return errors
    }

    const validateByIndexes = (dontTry, validators, ...indexes) => {
      const errors = []
      for (let i = 0, len = indexes.length; i < len; i ++) {
        const index = indexes[i]
        const isBreak = runOne(dontTry, validators, index, errors)
        if (isBreak) {
          break
        }
      }
      return errors
    }

    return (...args) => {
      // ignore if disabled
      if (this.disabled(key, context)) {
        return []
      }

      // if user did not fill the value, and the field is not required, there is no need to get error
      if (isEmpty(value) && !this.required(key, context)) {
        return []
      }

      const first = args[0]
      // array, pass custom valiators which is not in schema, i.e. schema.$validate('some', value, model)([{ validate: v => v > 0, message: 'should > 0' }])
      if (isArray(first) && first[0] && typeof first[0] === 'object') {
        return validateByRange(1, first, [])
      }
      // array, i.e. schema.$validate('some', value, model)([2, 6])
      else if (isArray(first)) {
        return validateByRange(0, validators, first)
      }
      // number, i.e. schema.$validate('some', value, model)(1, 2, 4, 6)
      else if (isNumber(first)) {
        return validateByIndexes(0, validators, ...args)
      }
      else {
        return []
      }
    }
  }

  /**
   * validate type and vaidators
   * @param {*} key
   * @param {*} value
   * @param {*} context
   */
  validate(key, value, context) {
    const meta = this[key]
    const errors = []

    if (!meta) {
      const e = {
        action: 'validate',
        key,
        value,
        message: `${key} is not existing in schema.`,
      }
      this._catch(key, e, context)
      return errors
    }

    const errs = this.$validate(key, value, context)([])
    errors.push(...errs)

    return errors
  }

  $validateAsync(key, value, context) {
    const meta = this[key]
    const { validators = [] } = meta

    function asyncx(fn) {
      return function(...args) {
        try {
          return Promise.resolve(fn.call(this, ...args))
        }
        catch (e) {
          return Promise.reject(e)
        }
      }
    }

    const validate = (dontTry, validator, index) => {
      const { determine, validate, message } = validator

      if (isBoolean(determine) && !determine) {
        return Promise.resolve()
      }

      const test = () => {
        return asyncx(determine).call(context, value, key).catch((error) => {
          if (dontTry) {
            throw error
          }
          const e = {
            action: '$validateAsync',
            key,
            value,
            error,
            attr: 'validators[' + index + '].determine',
          }
          this._catch(key, e, context)
          return false
        })
      }

      const check = () => {
        return asyncx(validate).call(context, value, key).catch((error) => {
          if (dontTry) {
            throw error
          }
          const e = {
            action: '$validateAsync',
            key,
            value,
            error,
            attr: 'validators[' + index + '].validate',
          }
          this._catch(key, e, context)
          return true
        })
      }

      const say = (res) => {
        return asyncx(message).call(context, value, key, res).catch((error) => {
          if (dontTry) {
            throw error
          }
          const e = {
            action: '$validateAsync',
            key,
            value,
            error,
            attr: 'validators[' + index + '].message',
          }
          this._catch(key, e, context)
        })
      }

      const gen = (msg) => {
        // interpolate with meta, so that we can provide more info
        const message = interpolate(msg, { key, value, ...meta })

        const error = {
          key,
          value,
          at: index,
          message,
        }
        return error
      }

      const create = (res) => {
        let msg = isString(message) ? message
          // if validate return an error, use error message as
          : isInstanceOf(res, Error) ? res.message
          : ''

        if (isFunction(message)) {
          return say(res).then((o) => {
            msg = o || msg
            return gen(msg)
          })
        }
        else {
          return gen(msg)
        }
      }

      const run = () => {
        return check().then((res) => {
          // private: if the validate result is an array, it may the submodel return the validate error directly
          if (isArray(res)) {
            return res
          }

          // true, 'xxx', {}, 1, 2, 3... are allowed
          // if a dev want to use custom message, he can return an Error
          if (res && !isInstanceOf(res, Error)) {
            return
          }

          return create(res)
        })
      }

      if (isFunction(determine)) {
        return test().then((bool) => {
          if (bool) {
            return run()
          }
        })
      }

      return run()
    }

    const pipe = (dontTry, validators) => {
      const errors = []
      let i = 0
      const through = () => {
        const validator = validators[i]
        if (!validator) {
          return Promise.resolve()
        }

        const { break: isBreak } = validator
        return validate(dontTry, validator, i).then((error) => {
          if (error) {
            if (isArray(error)) {
              const errs = error.filter(item => !!item && typeof item === 'object' && item.message)
              errors.push(...errs)
            }
            else {
              errors.push(error)
            }
            if (isBreak) {
              return Promise.resolve()
            }
          }
          i ++
          return through()
        })
      }
      return through().then(() => errors)
    }

    const validateByRange = (dontTry, validators, [start = 0, end = validators.length - 1]) => {
      const items = []
      for (let i = start; i <= end; i ++) {
        const validator = validators[i]
        if (validator) {
          items.push(validator)
        }
      }
      return pipe(dontTry, items)
    }

    const validateByIndexes = (dontTry, validators, ...indexes) => {
      const items = []
      for (let i = 0, len = indexes.length; i < len; i ++) {
        const index = indexes[i]
        const validator = validators[index]
        if (validator) {
          items.push(validator)
        }
      }
      return pipe(dontTry, items)
    }

    return (...args) => {
      // ignore if disabled
      if (this.disabled(key, context)) {
        return Promise.resolve([])
      }

      // if user did not fill the value, and the field is not required, there is no need to get error
      if (isEmpty(value) && !this.required(key, context)) {
        return Promise.resolve([])
      }

      const first = args[0]
      // array, pass custom valiators which is not in schema, i.e. schema.$validate('some', value, model)([{ validate: v => v > 0, message: 'should > 0' }])
      if (isArray(first) && first[0] && typeof first[0] === 'object') {
        return validateByRange(1, first, [])
      }
      // array, i.e. schema.$validate('some', value, model)([2, 6])
      else if (isArray(first)) {
        return validateByRange(0, validators, first)
      }
      // number, i.e. schema.$validate('some', value, model)(1, 2, 4, 6)
      else if (isNumber(first)) {
        return validateByIndexes(0, validators, ...args)
      }
      else {
        return Promise.resolve([])
      }
    }
  }

  validateAsync(key, value, context) {
    const meta = this[key]

    if (!meta) {
      const e = {
        action: 'validate',
        key,
        value,
        message: `${key} is not existing in schema.`,
      }
      this._catch(key, e, context)
      return Promise.resolve([])
    }

    return this.$validateAsync(key, value, context)([])
  }

  $parse(key, value, data, context) {
    const meta = this[key]
    if (!meta) {
      return value
    }

    const { catch: handle, create, force } = meta

    let coming = value

    if (isFunction(create)) {
      coming = this._trydo(
        () => create.call(context, value, key, data),
        (error) => isFunction(handle) && handle.call(context, error, key) || value,
        {
          key,
          attr: 'create',
        },
      )
    }

    if (isUndefined(coming) || (force && this.check(key, coming, context))) {
      coming = this.getDefault(key, context)
    }

    return coming
  }

  /**
   * parse data by passed data with `create` option, you'd better to call ensure to after parse to make sure your data is fix with type
   * @param {*} json
   * @param {*} context
   */
  parse(json, context) {
    const output = {}

    each(this, (meta, key) => {
      const { asset } = meta
      const dataKey = asset ? (isFunction(asset) ? asset(json, key) : asset) : key
      const value = json[dataKey]

      const coming = this.$parse(key, value, json, context)

      output[key] = coming
    })

    return output
  }

  /**
   * export to get output data
   * @param {*} data
   * @param {*} context
   */
  export(data, context) {
    const patch = {}
    const output = {}

    each(this, (meta, key) => {
      const { drop, map, flat, catch: handle, to = key } = meta
      const value = data[key]

      if (this.disabled(key, context)) {
        return
      }

      if (isFunction(flat)) {
        const res = this._trydo(
          () => flat.call(context, value, key, data) || {},
          (error) => isFunction(handle) && handle.call(context, error, key) || {},
          {
            key,
            attr: 'flat',
          },
        )
        patchObj(patch, res)
      }

      if (isBoolean(drop) && drop) {
        return
      }

      if (isFunction(drop)) {
        const bool = this._trydo(
          () => drop.call(context, value, key, data),
          (error) => isFunction(handle) && handle.call(context, error, key) || false,
          {
            key,
            attr: 'drop',
          },
        )
        if (bool) {
          return
        }
      }

      if (isFunction(map)) {
        const res = this._trydo(
          () => map.call(context, value, key, data),
          (error) => isFunction(handle) && handle.call(context, error, key) || value,
          {
            key,
            attr: 'map',
          },
        )
        output[to] = res
      }
      else {
        output[to] = value
      }
    })

    const result = Object.assign(output, patch)
    return result
  }

  /**
   * export a json to backup model
   * @param {*} data
   * @param {*} context
   */
  record(data, context) {
    const output = {}

    each(this, (meta, key) => {
      const { save, catch: handle, asset } = meta
      const value = data[key]
      const dataKey = asset ? (isFunction(asset) ? asset(json, key) : asset) : key

      if (isFunction(save)) {
        const res = this._trydo(
          () => save.call(context, value, key, data) || {},
          (error) => isFunction(handle) && handle.call(context, error, key) || {},
          {
            key,
            attr: 'save',
          },
        )

        // has asset but return an object which contains the asset key
        if (asset && isObject(res) && inObject(dataKey, res)) {
          patchObj(output, res)
        }
        else if (asset) {
          patchObj(output, { [dataKey]: res })
        }
        else if (isObject(res)) {
          patchObj(output, res)
        }
        // if res is not an object, use it as value directly
        else {
          patchObj(output, { [dataKey]: res })
        }
      }
      else {
        output[dataKey] = value
      }
    })

    return output
  }

  _trydo(fn, fallback, basic, force) {
    if (force) {
      return fn()
    }

    try {
      return fn()
    }
    catch (error) {
      const err = {
        ...basic,
        error,
      }
      const e = this.onError(err) || err
      return fallback(e)
    }
  }

  _catch(key, e, context) {
    this.onError(e)

    const meta = this[key]
    if (!meta) {
      return
    }

    const { catch: handle } = meta
    if (isFunction(handle)) {
      handle.call(context, e, key)
    }
  }

  onError() {}

  static defualtMessages = {
    type: `{key} does not match type.`,
    readonly: `{key} can not be set new value because of readonly.`,
    disabled: `{key} can not be set new value because of disabled.`,
  }
}
export default Schema
