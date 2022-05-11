import {
  inArray,
  isInstanceOf,
  isString,
  isObject,
  inObject,
  isNaN,
  isFunction,
  isArray,
  makeKeyChain,
  makeKeyPath,
  each,
  isUndefined,
  isNull,
  isEmpty,
} from 'ts-fns'

export class TyError extends TypeError {
  constructor(resource) {
    super()
    this.resources = []
    this.traces = []

    this.init(resource)
  }

  init(resource) {
    if (resource) {
      this.add(resource)
      this.commit()
      this.format()
    }
  }

  get message() {
    if (this._message) {
      return this._message
    }

    const message = this.format()
    this._message = message

    return message
  }

  get count() {
    return this.resources.length
  }

  /**
   * @param {string|error|object} resource
   */
  add(resource) {
    if (isString(resource)) {
      resource = new Error(resource)
    }
    if (isInstanceOf(resource, Error) || isObject(resource)) {
      this.resources.push(resource)
    }

    return this
  }

  replace(resource) {
    this.resources = []
    this.add(resource)
    return this
  }

  keep() {
    // do nothing
    return this
  }

  commit() {
    const traces = this.traces = []
    const items = makeErrorTraces(this)
    traces.push(...items)
    this.format()
    return this
  }

  error() {
    return this.count ? this : null
  }

  format(options = {}) {
    const traces = this.traces

    const {
      keyPathPrefix = TyError.keyPathPrefix,
      breaktag = traces.length < 2 ? '' : '\n',
      breakline = TyError.shouldBreakLongMessage,
      sensitive = TyError.shouldHideSensitiveData,
      templates = {},
      messagePrefix = '',
      messageSuffix = '',
    } = options
    const bands = { ...TyError.defaultMessages, ...templates }

    const messages = traces.map((trace, i) => {
      const { type, keyPath, value, name, pattern } = trace
      const info = name && !isUndefined(pattern) ? [name, pattern] : name ? [name] : pattern ? [pattern] : []
      const keys = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
      const key = keys.pop()

      const params = {
        i: i + 1,
        key,
        keyPath: keyPathPrefix + makeKeyPath(keyPath),
        should: info.length ? makeErrorShould(info, breakline) : '',
        receive: inObject('value', trace) ? makeErrorReceive(value, breakline, 0, sensitive) : '',
      }

      const text = makeErrorMessage(breaktag, params, bands) + makeErrorMessage(type, params, bands)
      return text
    })
    const message = messages.join('')
    const text = messagePrefix + message + messageSuffix

    this._message = text
    return text
  }

  translate(message, prefix, suffix) {
    const formatter = {
      keyPathPrefix: '',
    }
    if (message) {
      formatter.templates = {
        exception: message,
        unexcepted: message,
        dirty: message,
        overflow: message,
        missing: message,
        illegal: message,
        notin: message,
      }
    }
    if (prefix) {
      formatter.messagePrefix = prefix
    }
    if (suffix) {
      formatter.messageSuffix = suffix
    }
    this.format(formatter)
  }

  static shouldHideSensitiveData = false
  static shouldBreakLongMessage = false
  static defaultMessages = {
    exception: '{keyPath} should match `{should}`, but receive `{receive}`.',
    unexcepted: '{keyPath} should not match `{should}`, but receive `{receive}`.',
    dirty: '{keyPath} receive `{receive}` whose length does not match `{should}`.',
    overflow: '{keyPath} should not exists.',
    missing: '{keyPath} is missing.',
    illegal: 'key `{key}` at {keyPath} should match `{should}`',
    notin: '{keyPath} recieve `{receive}` did not match `{should}` in enum.',
  }
  static keyPathPrefix = '$.'
  static messagePrefix = ''
}

// ====================

function createSpace(count = 0) {
  if (!count) {
    return ''
  }

  let str = ''
  for (let i = 0; i < count; i ++) {
    str += ' '
  }
  return str
}

function makeErrorMessage(type, params, templates) {
  const message = templates[type] || type
  const text = message.replace(/\{(.*?)\}/g, (match, key) => inObject(key, params) ? params[key] : match)
  return text
}

function makeValueString(value, sensitive = false, breakline = true, space = 2) {
  const britems = (items, start, end, space = 2) => {
    if (!breakline) {
      return start + items.join(',') + end
    }

    if (items.join(',').length < 25 && items.length < 6) {
      return start + items.join(',') + end
    }

    let str = start
    let spacestr = createSpace(space)
    items.forEach((item) => {
      str += '\n    ' + spacestr + item + ','
    })
    str += '\n    ' + createSpace(space - 2) + end
    return str
  }
  const stringify = (value, space = 2) => {
    if (isObject(value)) {
      if (isEmpty(value)) {
        return '{}'
      }

      let str = '{'

      if (!breakline) {
        each(value, (value, key) => {
          str += key + ':' + stringify(value) + ','
        })
        str = str.substr(0, str.length - 1)
        str += '}'
        return str
      }

      let spacestr = createSpace(space)
      each(value, (value, key) => {
        str += '\n    ' + spacestr + key + ': ' + stringify(value, space + 2) + ','
      })
      str += '\n    ' + createSpace(space - 2) + '}'
      return str
    }
    else if (isArray(value)) {
      if (!value.length) {
        return '[]'
      }

      let str = '['

      if (!breakline) {
        value.forEach((item) => {
          str += stringify(item)
        })
        str = str.substr(0, str.length - 1)
        str += ']'
        return str
      }

      let spacestr = createSpace(space)
      value.forEach((item) => {
        str += '\n    ' + spacestr + stringify(item, space + 2) + ','
      })
      str += '\n    ' + createSpace(space - 2) + ']'
      return str
    }
    else {
      return make(value, sensitive, breakline, space)
    }
  }

  const records = []

  function make(value, sensitive = false, breakline = true, space = 2) {
    const totype = typeof value
    if (inArray(totype, ['boolean', 'undefined']) || isNull(value) || isNaN(value)) {
      return value + ''
    }
    else if (totype === 'number') {
      return sensitive ? '***' : value + ''
    }
    else if (totype === 'string') {
      return JSON.stringify(sensitive ? '***' : value)
    }
    else if (isFunction(value)) {
      return value.name + '()'
    }
    else if (isArray(value)) {
      const items = value.map(item => make(item, sensitive, breakline, space + 2))
      const output = britems(items, '[', ']', space)
      return output
    }
    else if (isObject(value)) {
      const keys = Object.keys(value)
      const output = sensitive ? britems(keys, '{', '}', space) : stringify(value, space)
      return output
    }
    else if (typeof value === 'object') { // for class instances
      // type or rule
      if (inObject('pattern', value)) {
        const name = value.name

        // deep self-ref
        if (inArray(value, records)) {
          return isString(name) ? name : `ref:${name}`
        }
        records.push(value)

        const output = make(value.pattern, sensitive, breakline, space)
        return isString(name) ? name + '(' + output + ')' : output
      }
      else {
        return value.name ? value.name : value.constructor ? value.constructor.name : 'Object'
      }
    }
    else if (typeof value === 'function') { // for native functions or classes
      return value.name ? value.name : value.constructor ? value.constructor.name : 'Function'
    }
    else {
      const output = value.toString()
      return output
    }
  }

  return make(value, sensitive, breakline, space = 2)
}

function makeErrorReceive(value, breakline = true, space = 0, sensitive = false) {
  const output = makeValueString(value, sensitive, breakline, space)
  return output
}

function makeErrorShould(info, breakline = true, space = 0) {
  if (info.length === 0) {
    return '%unknown'
  }

  if (info.length === 1) {
    return makeValueString(info[0], false, breakline, space)
  }

  const [name, pattern] = info
  const output = name + '(' + makeValueString(pattern, false, breakline, space) + ')'
  return output
}

function makeErrorTraces(tyerr, keyPath = []) {
  const { resources } = tyerr
  const traces = []
  resources.forEach((resource) => {
    const innerTraces = _makeErrorInnerTraces(resource, [...keyPath])
    traces.push(...innerTraces)
  })
  return traces
}

function _makeErrorInnerTraces(resource, keyPath = [], traces = []) {
  if (isInstanceOf(resource, TyError)) {
    const items = makeErrorTraces(resource, [...keyPath])
    traces.push(...items)
    return traces
  }
  else if (isInstanceOf(resource, Error)) {
    traces.push({ type: resource.message, keyPath })
    return traces
  }

  const { key, index, type, value, name, pattern, error, errors } = resource

  if (!isUndefined(key)) {
    keyPath.push(key)
  }
  else if (!isUndefined(index)) {
    keyPath.push(index)
  }

  if (inArray(type, ['dirty', 'overflow', 'missing', 'illegal'])) {
    traces.push({ type, keyPath, name, value, pattern })
    return traces
  }

  if (type === 'notin' && isArray(errors)) {
    errors.forEach((error) => {
      const items = makeErrorTraces(error, [...keyPath])
      traces.push(...items.map(item => ({ ...item, type: 'notin' })))
    })
  }
  else if (!error) {
    traces.push({ type, keyPath, value, name, pattern })
  }
  else if (isInstanceOf(error, TyError)) {
    const items = makeErrorTraces(error, [...keyPath])
    traces.push(...items)
  }
  else if (isInstanceOf(error, Error)) {
    traces.push({ type: error.message, keyPath })
  }

  return traces
}
