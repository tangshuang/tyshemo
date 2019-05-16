export function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function isNumeric(value) {
  return isNumber(value) || (isString(value) && /^\-?[0-9]+(\.{0,1}[0-9]+){0,1}$/.test(value))
}

export function isBoolean(value) {
  return value === true || value === false
}

export function isString(value) {
  return typeof value === 'string'
}

export function isFunction(value) {
  return typeof value === 'function'
    && (value + '') !== `function ${value.name}() { [native code] }`
    && (value + '').indexOf('class ') !== 0
    && (value + '').indexOf('_classCallCheck(this,') === -1 // for babel transfered class
}

export function isSymbol(value) {
  return typeof value === 'symbol'
}

export function isObject(value) {
  return value && typeof value === 'object' && value.constructor === Object
}

export function isArray(value) {
  return Array.isArray(value)
}

export function inArray(value, arr) {
  return arr.indexOf(value) > -1
}

export function inObject(key, obj) {
  return inArray(key, Object.keys(obj))
}

export function isNull(value) {
  return value === null
}

export function isUndefined(value) {
  return value === undefined
}

export function isNaN(value) {
  return typeof value === 'number' && Number.isNaN(value)
}

export function isEmpty(value) {
  if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
		return true
	}
	else if (isArray(value)) {
		return value.length === 0
	}
	else if (isObject(value)) {
		return Object.keys(value).length === 0
	}
	return false
}

export function isInterface(f) {
  let instance = null
  try {
    instance = new f()
  }
  catch (e) {
    if (e.message.indexOf('is not a constructor') > -1) {
      instance = null
      return false
    }
  }
  instance = null
  return true
}

export function isInstanceOf(ins, Interface, strict) {
  return ins instanceof Interface && (strict ? ins.constructor === Interface : true)
}

export function isInheritedOf(SubInterface, Interface, strict) {
  const ins = SubInterface.prototype
  return isInstanceOf(ins, Interface, strict)
}

export function getInterface(ins) {
  return Object.getPrototypeOf(ins).constructor
}

/**
 * 求数组的并集
 * @param {*} a
 * @param {*} b
 * @example
 * unionArray([1, 2], [1, 3]) => [1, 2, 3]
 */
export function unionArray(a, b) {
  return a.concat(b.filter(v => !inArray(v, a)))
}

export function isEqual(val1, val2) {
  const equal = (obj1, obj2) => {
    let keys1 = Object.keys(obj1)
    let keys2 = Object.keys(obj2)
    let keys = unionArray(keys1, keys2)

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]

      if (!inArray(key, keys1)) {
        return false
      }
      if (!inArray(key, keys2)) {
        return false
      }

      let value1 = obj1[key]
      let value2 = obj2[key]
      if (!isEqual(value1, value2)) {
        return false
      }
    }

    return true
  }

  if (isObject(val1) && isObject(val2)) {
    return equal(val1, val2)
  }
  else if (isArray(val1) && isArray(val2)) {
    return equal(val1, val2)
  }
  else {
    return val1 === val2
  }
}

export function stringify(obj) {
  return JSON.stringify(obj)
}

export function each(obj, fn) {
  let keys = Object.keys(obj)
  keys.forEach((key) => {
    let value = obj[key]
    fn(value, key, obj)
  })
}

export function map(obj, fn) {
  if (!isObject(obj) || !isArray(obj)) {
    return obj
  }

  if (!isFunction(fn)) {
    return obj
  }

  let result = isArray(obj) ? [] : {}
  each(obj, (value, key) => {
    result[key] = isFunction(fn) ? fn(value, key, obj) || value : value
  })

  return result
}

export function clone(obj, fn) {
  let parents = []
  let clone = function(origin, path = '', obj) {
    if (!isObject(origin) && !isArray(origin)) {
      return origin
    }

    let result = isArray(origin) ? [] : {}
    let keys = Object.keys(origin)

    parents.push({ obj, path, origin, result })

    for (let i = 0, len = keys.length; i < len; i ++) {
      let key = keys[i]
      let value = origin[key]
      let referer = parents.find(item => item.origin === value)
      let computed = isFunction(fn) ? fn(value, key, origin, path, obj, referer) : value

      if (!isObject(computed) && !isArray(computed)) {
        result[key] = computed
      }
      else {
        if (referer) {
          result[key] = referer.result
        }
        else {
          result[key] = clone(computed, path ? path + '.' + key : key)
        }
      }
    }

    return result
  }

  let result = clone(obj, '', obj)
  parents = null
  return result
}

function makeKeyChain(path) {
  let chain = path.toString().split(/\.|\[|\]/).filter(item => !!item)
  return chain
}

/**
 * 根据keyPath读取对象属性值
 * @param {*} obj
 * @param {*} path
 * @example
 * parse({ child: [ { body: { head: true } } ] }, 'child[0].body.head') => true
 */
export function parse(obj, path) {
  let chain = makeKeyChain(path)

  if (!chain.length) {
    return obj
  }

  let target = obj
  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    if (target[key] === undefined) {
      return undefined
    }
    target = target[key]
  }
  return target
}

/**
 * 根据keyPath设置对象的属性值
 * @param {*} obj
 * @param {*} path
 * @param {*} value
 * @example
 * assign({}, 'body.head', true) => { body: { head: true } }
 */
export function assign(obj, path, value) {
  let chain = makeKeyChain(path)

  if (!chain.length) {
    return obj
  }

  let key = chain.pop()

  if (!chain.length) {
    obj[key] = value
    return obj
  }

  let target = obj

  for (let i = 0, len = chain.length; i < len; i ++) {
    let key = chain[i]
    let next = chain[i + 1] || key
    if (/^[0-9]+$/.test(next) && !isArray(target[key])) {
      target[key] = []
    }
    else if (typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }

  target[key] = value

  return obj
}

export function sortBy(items, keyPath) {
  let res = [].concat(items)
  res.sort((a, b) => {
    let oa = parse(a, keyPath)
    let ob = parse(b, keyPath)

    oa = typeof oa === 'number' && !isNaN(oa) ? oa : 10
    ob = typeof ob === 'number' && !isNaN(ob) ? ob : 10

    if (oa < ob) {
      return -1
    }
    if (oa === ob) {
      return 0
    }
    if (oa > ob) {
      return 1
    }
  })
  return res
}

/**
 * 将一个对象的属性层级打平，多级变为一级，主要用于表单提交使用
 * @param {*} obj
 * @param {function} determine 用于决定一个对象是否要更深一步去打平，返回true表示要更深一层，返回false则直接将该对象作为键值
 */
export function flatObject(obj, determine) {
  const flat = (input, path = '', result = {}) => {
    if (isArray(input)) {
      input.forEach((item, i) => flat(item, `${path}[${i}]`, result));
      return result;
    }
    else if (isObject(input)) {
      if (isFunction(determine) && !determine(input)) {
        result[path] = input;
        return result
      }

      let keys = Object.keys(input);
      keys.forEach((key) => {
        let value = input[key];
        flat(value, !path ? key : `${path}[${key}]`, result);
      });
      return result;
    }
    else {
      result[path] = input;
      return result;
    }
  }
  if (!obj || typeof obj !== 'object') {
    return {}
  }
  return flat(obj)
}

export function extractObject(obj, keys) {
  const results = {}
  keys.forEach((key) => {
    if (inObject(key, obj)) {
      results[key] = obj[key]
    }
  })
  return results
}

export function iterate(obj, fn) {
  const keys = Object.keys(obj)
  for (let i = 0, len = keys.length; i < len; i ++) {
    const key = keys[i]
    const value = obj[key]
    const res = fn(value, key, obj)
    if (res !== undefined) {
      return res
    }
  }
}
