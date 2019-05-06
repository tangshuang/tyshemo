import { inObject, stringify, isInstanceOf, inArray, isArray, isObject, isFunction, isNaN } from './utils.js'

function makeErrorMessage(key, params) {
  let message = TySheMoError.messages[key] || key
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

  let keyPath = inObject('key', params) ? params.key : inObject('index', params) ? `[${params.index}]` : ''
  let currentPath = ''
  traces.forEach((item) => {
    if (inObject('key', item)) {
      currentPath = currentPath + '.' + item.key
    }
    if (inObject('index', item)) {
      currentPath = currentPath + '[' + item.index + ']'
    }
    item.keyPath = currentPath
  })

  let e = new Error()
  let stack = e.stack || e.stacktrace
  let stacks = stack.split('\n')
  stacks.shift()
  stacks.shift()
  stack = stacks.join('\n')

  let trace = Object.assign({}, params, { stack, keyPath })
  traces.unshift(trace)

  return error
}

export class TySheMoError extends TypeError {
  constructor(key, params = {}) {
    super(key)
    Object.defineProperties(this, {
      traces: {
        value: [],
      },
      summary: {
        get() {
          const getValueSummary = (value, masking = false) => {
            let totype = typeof(value)
            if (inArray(totype, ['boolean', 'undefined']) || value === null || isNaN(value)) {
              return value
            }
            else if (totype === 'number') {
              let output = masking ? `Number` : value
              return output
            }
            else if (totype === 'string') {
              let output = masking ? `String` : value
              return stringify(output)
            }
            else if (isFunction(value)) {
              return `Function:${value.name}()`
            }
            else if (isArray(value)) {
              let name = 'Array'
              if (masking) {
                return `${name}(${value.length})`
              }
              else {
                return `[${value.map(item => getValueSummary(item, masking)).join(',')}]`
              }
            }
            else if (isObject(value)) {
              let keys = Object.keys(value)
              if (masking) {
                return `{${keys.join(',')}}`
              }
              else {
                let values = []
                keys.forEach((key) => {
                  values.push(`${key}:` + getValueSummary(value[key], masking))
                })
                return `{${values.join(',')}}`
              }
            }
            else if (typeof value === 'object') { // for class instances
              return value.name ? value.name : value.constructor ? value.constructor.name : 'Object'
            }
            else if (typeof value === 'function') { // for native functions or classes
              return value.name ? value.name : value.constructor ? value.constructor.name : 'Function'
            }
            else {
              let output = value.toString()
              let res = masking ? '*********' : output
              return res
            }
          }
          const getTraceSummary = (info) => {
            if (!info.level) {
              return 'unknown'
            }

            const level = info.level
            const source = info[level]
            const name = getValueSummary(source)

            let should = name

            if (inArray(name, ['List', 'Tuple', 'Enum'])) {
              let pattern = source.pattern.map(item => getValueSummary(item))
              should = `${name}(${pattern.join(',')})`
            }
            else if (name === 'Dict') {
              let pattern = source.pattern
              let keys = Object.keys(pattern)
              should = `Dict({${keys.join(',')}})`
            }
            else if (name === 'Type') {
              let pattern = source.pattern
              should = getValueSummary(pattern)
            }
            else if (level === 'rule') {
              should = name
            }

            return should
          }

          const traces = this.traces
          let info = traces[traces.length - 1] // use last trace which from the stack bottom as base info
          let research = ''

          let lastResearch = ''
          traces.forEach((item, i) => {
            let prev = traces[i - 1]
            let keyPath = item.keyPath
            let sep = ''
            let nextResearch = getTraceSummary(item)

            if (prev && prev.keyPath !== keyPath) { // keyPath changed
              sep = '/'
            }
            else if (nextResearch !== lastResearch) {
              sep = ';'
            }
            research += i > 0 ? sep : ''

            if (prev && prev.keyPath !== keyPath && (item.key || item.index)) {
              research += (item.key || item.index) + ':'
            }

            if (nextResearch !== lastResearch) {
              research += nextResearch
            }

            lastResearch = nextResearch

            if (keyPath === info.keyPath) {
              info = Object.assign({}, info, item)
            }
          })

          let summary = {
            value: info.value,
            receive: getValueSummary(info.value, this.masking), // received node value
            should: getTraceSummary(info), // node rule
            research,
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
      masking: {
        value: false,
        writable: true,
      },
    })
    makeError(this, params)
  }
}

TySheMoError.messages = {
  mistaken: '{keyPath} should match {should}, but receive {receive}.',
  unexcepted: '{keyPath} should not match {should}, but receive {receive}.',
  dirty: '{keyPath} does not match {should}, length should be {length}.',
  overflow: '{keyPath} should not exists.',
  missing: '{keyPath} is missing.',
}

export default TySheMoError
