import { inArray, isInstanceOf, makeKeyPath, isString, isObject, each, inObject, isNaN, isFunction, isArray } from './utils.js'

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
    const items = makeErrorResources(this)
    traces.push(...items)
    this.format()
    return this
  }

  error() {
    return this.count ? this : null
  }

  format(templates = {}, breaktag = '\n', breakline, sensitive) {
    const bands = { ...TyError.defaultMessages, ...templates }
    const traces = this.traces

    if (breakline === undefined) {
      breakline = TyError.shouldBreakLongMessage
    }

    if (sensitive === undefined) {
      sensitive = TyError.shouldUseSensitiveData
    }

    // make more friendly
    if (traces.length < 2) {
      breaktag = ''
    }

    const messages = traces.map((trace, i) => {
      const { type, keyPath, value, name, pattern } = trace
      const info = name && pattern ? [name, pattern] : name ? [name] : pattern ? [pattern] : []

      const params = {
        i: i + 1,
        keyPath: makeKeyPath(keyPath),
        should: info.length ? makeErrorShould(info, breakline) : '',
        receive: inObject('value', trace) ? makeErrorReceive(value, breakline, sensitive) : '',
      }

      const text = makeErrorMessage(breaktag, params, bands) + makeErrorMessage(type, params, bands)
      return text
    })
    const message = messages.join('')

    this._message = message
    return message
  }
}

TyError.shouldUseSensitiveData = true
TyError.shouldBreakLongMessage = false
TyError.defaultMessages = {
  exception: '{keyPath} should match `{should}`, but receive `{receive}`.',
  unexcepted: '{keyPath} should not match `{should}`, but receive `{receive}`.',
  dirty: '{keyPath} receive `{receive}` whose length does not match `{should}`.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

export default TyError

// ====================

function makeErrorMessage(type, params, templates) {
  const message = templates[type] || type
  const text = message.replace(/\{(.*?)\}/g, (match, key) => inObject(key, params) ? params[key] : match)
  return text
}

function makeValueString(value, sensitive = true, breakline = true, space = 2) {
  const totype = typeof value

  const createspace = (count) => {
    let str = ''
    for (let i = 0; i < count; i ++) {
      str += ' '
    }
    return str
  }
  const britems = (items, start, end, space = 2) => {
    if (!breakline) {
      return start + items.join(',') + end
    }

    if (items.join(',').length < 25 && items.length < 6) {
      return start + items.join(',') + end
    }

    let str = start
    let spacestr = createspace(space)
    items.forEach((item) => {
      str += '\n    ' + spacestr + item + ','
    })
    str += '\n    ' + createspace(space - 2) + end
    return str
  }
  const stringify = (value, space = 2) => {
    if (isObject(value)) {
      let str = '{'

      if (!breakline) {
        each(value, (value, key) => {
          str += key + ':' + stringify(value) + ','
        })
        str = str.substr(0, str.length - 1)
        str += '}'
        return str
      }

      let spacestr = createspace(space)
      each(value, (value, key) => {
        str += '\n    ' + spacestr + key + ': ' + stringify(value, space + 2) + ','
      })
      str += '\n    ' + createspace(space - 2) + '}'
      return str
    }
    else if (isArray(value)) {
      let str = '['

      if (!breakline) {
        value.forEach((item) => {
          str += stringify(item)
        })
        str = str.substr(0, str.length - 1)
        str += ']'
        return str
      }

      let spacestr = createspace(space)
      value.forEach((item) => {
        str += '\n    ' + spacestr + stringify(item, space + 2) + ','
      })
      str += '\n    ' + createspace(space - 2) + ']'
      return str
    }
    else {
      return makeValueString(value, sensitive, breakline, space)
    }
  }

  if (inArray(totype, ['boolean', 'undefined']) || value === null || isNaN(value)) {
    return value + ''
  }
  else if (totype === 'number') {
    return sensitive ? value + '' : '***'
  }
  else if (totype === 'string') {
    return JSON.stringify(sensitive ? value : '***')
  }
  else if (isFunction(value)) {
    return value.name + '()'
  }
  else if (isArray(value)) {
    let items = value.map(item => makeValueString(item, sensitive, breakline, space + 2))
    let output = britems(items, '[', ']', space)
    return output
  }
  else if (isObject(value)) {
    let keys = Object.keys(value)
    let output = sensitive ? stringify(value) : britems(keys, '{', '}', space)
    return output
  }
  else if (typeof value === 'object') { // for class instances
    // type or rule
    if (inObject('pattern', value)) {
      const name = value.name
      const output = makeValueString(value.pattern, sensitive, breakline, space)
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
    let output = value.toString()
    return output
  }
}

function makeErrorReceive(value, breakline = true, sensitive = true) {
  const output = makeValueString(value, sensitive, breakline)
  return output
}

function makeErrorShould(info, breakline = true) {
  if (info.length === 0) {
    return '%unknown'
  }

  if (info.length === 1) {
    return makeValueString(info[0], true, breakline)
  }

  const [name, pattern] = info
  const output = name + '(' + makeValueString(pattern, true, breakline) + ')'
  return output
}

function makeErrorResources(tyerr, keyPath = []) {
  const { resources } = tyerr
  const traces = []
  resources.forEach((resource) => {
    const innerTraces = makeErrorTraces(resource, [...keyPath])
    traces.push(...innerTraces)
  })
  return traces
}

function makeErrorTraces(resource, keyPath = [], traces = []) {
  if (isInstanceOf(resource, TyError)) {
    const items = makeErrorResources(resource, [...keyPath])
    traces.push(...items)
    return traces
  }
  else if (isInstanceOf(resource, Error)) {
    traces.push({ type: resource.message, keyPath })
    return traces
  }

  const { key, index, type, value, name, pattern, error } = resource

  if (key !== undefined) {
    keyPath.push(key)
  }
  else if (index !== undefined) {
    keyPath.push(index)
  }

  if (inArray(type, ['dirty', 'overflow', 'missing'])) {
    traces.push({ type, keyPath, name, value, pattern })
    return traces
  }

  if (!error) {
    traces.push({ type, keyPath, value, name, pattern })
    return traces
  }
  else if (isInstanceOf(error, TyError)) {
    const items = makeErrorResources(error, [...keyPath])
    traces.push(...items)
    return traces
  }
  else if (isInstanceOf(error, Error)) {
    traces.push({ type: error.message, keyPath })
    return traces
  }
  else {
    return traces
  }
}
