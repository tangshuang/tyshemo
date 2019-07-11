import { inArray, isInstanceOf, makeKeyPath, isString, isObject, each, inObject, isNaN, isFunction, isArray, repeatString } from './utils.js'

const Messages = {
  exception: '{keyPath} should match {should}, but receive {receive}.',
  unexcepted: '{keyPath} should not match {should}, but receive {receive}.',
  dirty: '{keyPath} length does not match {should}, receive {receive}.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

export class TyError extends TypeError {
  constructor(message) {
    super()
    this.resources = []
    this.traces = []

    this.init(message)
  }

  init(message) {
    this.__message = message
    this.__params = {}
  }

  get message() {
    if (this._message) {
      return this._message
    }

    if (this.__message) {
      const message = makeErrorMessage(this.__message, this.__params, Messages)
      return message
    }

    const message = this.translate(Messages)
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

  feed(params = {}) {
    this.__params = params
  }

  commit() {
    const traces = this.traces = []
    this.resources.forEach((item) => {
      if (isInstanceOf(item, Error)) {
        traces.push(item)
        return
      }

      const innerTraces = makeErrorTraces(item)
      traces.push(...innerTraces)
    })
  }

  translate(templates, seprateor = '\nx: >> ') {
    const traces = this.traces

    // make more friendly
    if (traces.length < 2) {
      seprateor = ''
    }

    const messages = traces.map((trace) => {
      if (isInstanceOf(trace, Error)) {
        const text = makeErrorMessage(trace.message, {}, templates)
        return text
      }

      const { type, keyPath, value, name, pattern } = trace
      const info = name && pattern ? [name, pattern] : name ? [name] : pattern ? [pattern] : []

      const params = {
        keyPath: makeKeyPath(keyPath),
        should: isArray(info) ? makeErrorShould(info) : '',
        receive: inObject('value', trace) ? makeErrorReceive(value) : '',
      }

      const text = seprateor + makeErrorMessage(type, params, templates)
      return text
    })
    const message = messages.join('')

    return message
  }
}

TyError.shouldUseDetailMessage = true
TyError.defaultMessages = Messages

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
  const britems = (keys, start, end) => {
    let str = start
    let spacestr = createspace(space)
    keys.forEach((key) => {
      str += '\n    ' + spacestr + key + ','
    })
    str += '\n    ' + createspace(space - 2) + end
    return str
  }
  const stringify = (value, space = 2) => {
    if (isObject(value)) {
      let str = '{'
      let spacestr = createspace(space)
      each(value, (value, key) => {
        str += '\n    ' + spacestr + key + ': ' + stringify(value, space + 2) + ','
      })
      str += '\n    ' + createspace(space - 2) + '}'
      return str
    }
    else if (isArray(value)) {
      let str = '['
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
    let output = britems(items, '[', ']')
    return output
  }
  else if (isObject(value)) {
    let keys = Object.keys(value)
    let output = useDetail ? stringify(value) : britems(keys, '{', '}')
    return output
  }
  else if (typeof value === 'object') { // for class instances
    // type or rule
    if (inObject('pattern', value)) {
      const name = value.name
      const output = makeValueString(value.pattern, useDetail, space + 2)
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
  else {
    return traces
  }
}
