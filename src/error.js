import { inObject, isInstanceOf, inArray, isArray, isObject, isFunction, makeKeyPath } from './utils.js'

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
  traces.unshift(trace)

  return error
}

function stringify(value) {
  return JSON.stringify(value, null, 2)
}

/**
 * get some value's string
 * @param {*} value
 */
export function makeValueString(value) {
  const totype = typeof value

  if (inArray(totype, ['boolean', 'undefined']) || value === null || totype === 'number') {
    return value
  }
  else if (totype === 'string') {
    let output = stringify(value)
    return output
  }
  else if (isFunction(value)) {
    return value.name + '()'
  }
  else if (isArray(value) || isObject(value)) {
    let output = stringify(value)
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

function makePatternString(info) {
  if (!info.level) {
    return 'unknown'
  }

  const level = info.level
  const source = info[level]
  const name = makeValueString(source)

  let should = name

  if (inArray(name, ['List', 'Tuple', 'Enum'])) {
    let pattern = source.pattern
    should = `${name}(${stringify(pattern)})`
  }
  else if (name === 'Dict') {
    let pattern = source.pattern
    should = `Dict(${stringify(pattern)})`
  }
  else if (name === 'Type') {
    let pattern = source.pattern
    should = makeValueString(pattern)
  }
  else if (level === 'rule') {
    should = name
  }

  return should
}

export class TyError extends TypeError {
  constructor(key, params = {}) {
    super(key)
    Object.defineProperties(this, {
      traces: {
        value: [],
      },
      summary: {
        get() {
          const getTraceSummary = (info) => {
            if (!info.level) {
              return 'unknown'
            }

            const level = info.level
            const source = info[level]
            const name = makeValueString(source)

            let should = name

            if (inArray(name, ['List', 'Tuple', 'Enum'])) {
              let pattern = source.pattern
              should = `${name}(${stringify(pattern)})`
            }
            else if (name === 'Dict') {
              let pattern = source.pattern
              should = `Dict(${stringify(pattern)})`
            }
            else if (name === 'Type') {
              let pattern = source.pattern
              should = makeValueString(pattern)
            }
            else if (level === 'rule') {
              should = name
            }

            return should
          }

          const traces = this.traces
          let info = traces[traces.length - 1] // use last trace which from the stack bottom as base info

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

          let summary = {
            value: info.value,
            receive: makeValueString(info.value), // received node value
            should: getTraceSummary(info), // node rule
            keyPath,
          }
          let res = Object.assign({}, info, summary)

          delete res.type
          delete res.rule

          return res
        },
      },
      message_key: {
        value: key,
      },
      message: {
        get() {
          let message = makeErrorMessage(key, this.summary)
          return message
        },
      },
      addtrace: {
        value: function(params) {
          makeError(this, params)
          return this
        },
      },
      translate: {
        value: function(text, replace) {
          if (replace) {
            // after this, error.message will get new text
            key = text
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
  dirty: '{keyPath} does not match {should}, length should be {length}.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

export default TyError
