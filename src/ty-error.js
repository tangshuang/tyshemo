import { inArray, isInstanceOf, makeKeyPath, isString, isObject, each, inObject, isNaN, isFunction, isArray } from './utils.js'

const MESSAGES = {
  exception: '{keyPath} should match `{should}`, but receive `{receive}`.',
  unexcepted: '{keyPath} should not match `{should}`, but receive `{receive}`.',
  dirty: '{keyPath} length does not match `{should}`, receive `{receive}`.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

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
      this.translate()
    }
  }

  get message() {
    if (this._message) {
      return this._message
    }

    const message = this.translate()
    this._message = message

    return message
  }

  get count() {
    return this.resources.length
  }

  add(resource) {
    this.resources.push(resource)
  }

  replace(resource) {
    this.resources = [resource]
  }

  keep() {
    // do nothing
  }

  commit() {
    const traces = this.traces = []
    this.resources.forEach((item) => {
      if (!isInstanceOf(item, TyError) && isInstanceOf(item, Error)) {
        traces.push(item)
        return
      }

      const innerTraces = makeErrorTraces(item)
      traces.push(...innerTraces)
    })
  }

  translate(templates = {}, seprateor = '\nx: >> ', write = true) {
    const words = { ...MESSAGES, ...templates }

    const traces = this.traces

    // make more friendly
    if (traces.length < 2) {
      seprateor = ''
    }

    const messages = traces.map((trace) => {
      if (!isInstanceOf(trace, TyError) && isInstanceOf(trace, Error)) {
        const params = trace.params || {}
        const text = makeErrorMessage(trace.message, { ...params }, words)
        return text
      }

      const { type, keyPath, value, name, pattern } = trace
      const info = name && pattern ? [name, pattern] : name ? [name] : pattern ? [pattern] : []

      const params = {
        keyPath: makeKeyPath(keyPath),
        should: isArray(info) ? makeErrorShould(info) : '',
        receive: inObject('value', trace) ? makeErrorReceive(value) : '',
      }

      const text = seprateor + makeErrorMessage(type, params, words)
      return text
    })
    const message = messages.join('')

    if (write) {
      this._message = message
    }

    return message
  }
}

TyError.shouldUseDetailMessage = true
TyError.defaultMessages = MESSAGES
TyError.breakLongMessageLine = true

export default TyError

// ====================

function makeErrorMessage(type, params, templates) {
  const message = templates[type] || type
  const text = message.replace(/\{(.*?)\}/g, (match, key) => inObject(key, params) ? params[key] : match)
  return text
}

function makeValueString(value, useDetail, space = 2) {
  // defualt can be change
  if (useDetail === undefined) {
    useDetail = !!TyError.shouldUseDetailMessage
  }

  const totype = typeof value

  const createspace = (count) => {
    let str = ''
    for (let i = 0; i < count; i ++) {
      str += ' '
    }
    return str
  }
  const britems = (items, start, end, space = 2) => {
    if (!TyError.breakLongMessageLine) {
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

      if (!TyError.breakLongMessageLine) {
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

      if (!TyError.breakLongMessageLine) {
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
      return makeValueString(value, useDetail, space)
    }
  }

  if (inArray(totype, ['boolean', 'undefined']) || value === null || isNaN(value)) {
    return value + ''
  }
  else if (totype === 'number') {
    return useDetail ? value + '' : 'number:***'
  }
  else if (totype === 'string') {
    return JSON.stringify(useDetail ? value : '***')
  }
  else if (isFunction(value)) {
    return value.name + '()'
  }
  else if (isArray(value)) {
    let items = value.map(item => makeValueString(item, useDetail, space + 2))
    let output = britems(items, '[', ']', space)
    return output
  }
  else if (isObject(value)) {
    let keys = Object.keys(value)
    let output = useDetail ? stringify(value) : britems(keys, '{', '}', space)
    return output
  }
  else if (typeof value === 'object') { // for class instances
    // type or rule
    if (inObject('pattern', value)) {
      const name = value.name
      const output = makeValueString(value.pattern, useDetail, space)
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

function makeErrorReceive(value) {
  const output = makeValueString(value)
  return output
}

function makeErrorShould(info) {
  if (info.length === 0) {
    return '%unknown'
  }

  if (info.length === 1) {
    return makeValueString(info[0], true)
  }

  const [name, pattern] = info
  const output = name + '(' + makeValueString(pattern) + ')'
  return output
}

function makeErrorTraces(item, keyPath = [], traces = []) {
  if (isInstanceOf(item, TyError)) {
    const items = item.traces ? item.traces : []
    traces.push(...items)
    return traces
  }

  const { key, index, type, value, name, pattern, error } = item

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

  if (isInstanceOf(error, TyError)) {
    const { resources } = error
    resources.forEach(item => makeErrorTraces(item, [...keyPath], traces))
    return traces
  }
  else if (isInstanceOf(error, Error)) {
    traces.push(error)
    error.params = { keyPath: makeKeyPath(keyPath) }
    return traces
  }
  else {
    return traces
  }
}
