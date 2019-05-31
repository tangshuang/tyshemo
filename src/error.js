import { inObject, isInstanceOf, inArray, isArray, isObject, isFunction, makeKeyPath, each, isString } from './utils.js'

/**
 * create message by using TyError.messages
 * @param {*} key
 * @param {*} params
 */
export function makeErrorMessage(key, params) {
  let message = TyError.messages[key] || key
  let text = message.replace(/\{(.*?)\}/g, (match, key) => inObject(key, params) ? params[key] : match)
  return text
}

/**
 * add trace into an error
 * @param {*} error
 * @param {*} params the logic:
 * {
 *  target: passed value,
 *  type: current type name,
 *  rule: optional, if rule is passed, it means the type is a Functional type, i.e. Enum(String, Null) or IfExists(String), if it not passed, it means this type is a Stringal type.
 *  ... other props which may be needed
 * }
 */
export function makeError(error, params) {
  if (!isInstanceOf(error, Error)) {
    return null
  }

  let traces = error.traces ? error.traces : (error.traces = [])

  let e = new Error()
  let stack = e.stack || e.stacktrace
  let stacks = stack.split('\n')
  stacks.shift()
  stacks.shift()
  stack = stacks.join('\n')

  let trace = Object.assign({}, params, { stack })

  // make sure the bottom trace has message
  if (!traces.length) {
    trace.message = error.message
  }

  traces.unshift(trace)

  return error
}

/**
 * get some value's string
 * @param {*} value
 */
export function makeValueString(value, detail = true, space = 2) {
  const totype = typeof value

  const createspace = (count) => {
    let str = ''
    for (let i = 0; i < count; i ++) {
      str += ' '
    }
    return str
  }
  const britems = (keys) => {
    let str = ''
    let spacestr = createspace(space)
    keys.forEach((key) => {
      str += '\n' + spacestr + key + ','
    })
    str += '\n'
    return str
  }
  const stringify = (value, space = 2) => {
    if (isObject(value)) {
      let str = '{'
      let spacestr = createspace(space)
      each(value, (value, key) => {
        str += '\n' + spacestr + key + ': ' + stringify(value, space + 2) + ','
      })
      str += '\n}'
      return str
    }
    else if (isArray(value)) {
      let str = '['
      let spacestr = createspace(space)
      value.forEach((item) => {
        str += '\n' + spacestr + stringify(item, space + 2) + ','
      })
      str += ']'
      return str
    }
    else {
      return makeValueString(value)
    }
  }

  if (inArray(totype, ['boolean', 'undefined']) || value === null || totype === 'number') {
    return value
  }
  else if (totype === 'string') {
    let output = JSON.stringify(value)
    return output
  }
  else if (isFunction(value)) {
    return value.name + '()'
  }
  else if (isArray(value)) {
    let items = value.map(item => makeValueString(item, detail, space + 2))
    let output = `[${britems(items)}]`
    return output
  }
  else if (isObject(value)) {
    let keys = Object.keys(value)
    let output = detail ? stringify(value) : `{${britems(keys)}}`
    return output
  }
  else if (typeof value === 'object') { // for class instances
    return value.name ? value.name : value.constructor ? value.constructor.name : 'Object'
  }
  else if (typeof value === 'function') { // for native functions or classes
    return value.name ? value.name : value.constructor ? value.constructor.name : 'Function'
  }
  else {
    let output = value.toString()
    return output
  }
}

function makeErrorInfo(traces) {
  // get the last trace record, which is at the bottom of stack
  const info = traces[traces.length - 1]

  // the info should be created by new TyError
  const { message } = info
  if (!message) {
    return null
  }

  return info
}

function makePatterString(pattern) {
  if (typeof pattern === 'object' && !isObject(pattern)) {
    if (inObject('pattern', pattern)) {
      return makePatterString(pattern.pattern)
    }

    const { name } = pattern
    return makeValueString(name || pattern)
  }
  else {
    return makeValueString(pattern)
  }
}

function makeShouldString(info) {
  const { should = [] } = info || {}
  const [name, pattern] = should

  if (should.length === 0) {
    return '%unknown'
  }

  if (should.length === 1) {
    return makeValueString(name)
  }

  const patternstr = makePatterString(pattern)
  const output = isString(name) ? name + '(' + patternstr + ')' : patternstr
  return output
}

export class TyError extends TypeError {
  constructor(message, params = {}) {
    super(message)
    Object.defineProperties(this, {
      traces: {
        value: [],
      },
      addtrace: {
        value: function(params) {
          makeError(this, { ...params, message })
          return this
        },
      },
      summary: {
        get() {
          const traces = this.traces
          if (!traces.length) {
            return
          }

          const info = makeErrorInfo(traces)

          if (!info) {
            return null
          }

          const value = info.value
          const receive = makeValueString(value)
          const should = makeShouldString(info)

          let keyPath = []
          traces.forEach((item) => {
            let current = item.key || item.index || ''
            let prev = keyPath[keyPath.length - 1]
            if (current && current !== prev) {
              keyPath.push(current)
            }
          })
          keyPath = keyPath.filter(item => !!item)
          keyPath = makeKeyPath(keyPath)

          const summary = {
            ...info,
            value,
            receive,
            should,
            keyPath,
          }

          return summary
        },
      },
      message: {
        get() {
          // when the error is not thrown from type system
          if (!this.summary) {
            return message
          }
          return makeErrorMessage(message, this.summary)
        },
      },
      translate: {
        value: function(text, replace) {
          if (replace) {
            // after this, error.message will get new text
            message = text
          }

          if (!this.summary) {
            return text
          }
          return makeErrorMessage(text, this.summary)
        },
      },
    })
    makeError(this, params)
  }
}

TyError.messages = {
  mistaken: '{keyPath} should match {should}, but receive {receive}.',
  unexcepted: '{keyPath} should not match {should}, but receive {receive}.',
  dirty: '{keyPath} length does not match {should}, receive {receive}.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

export default TyError
