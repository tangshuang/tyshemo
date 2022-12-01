import {
  isObject,
  isInheritedOf,
  isArray,
  map,
  each,
  flatArray,
  define,
  makeKeyChain,
  parse,
  clone,
  isInstanceOf,
  isFunction,
  assign,
  isUndefined,
  inObject,
  isNull,
  inArray,
  getConstructorOf,
  createArray,
  makeKeyPath,
  hasOwnKey,
  decideby,
  refineProxy,
  isString,
} from 'ts-fns'

import { Schema as _Schema } from './schema.js'
import { Store as _Store } from './store.js'
import { ofChain, tryGet, makeMsg, isAsyncRef, isMemoRef, traverseChain } from './shared/utils.js'
import { edit } from './shared/edit.js'
import { Meta, AsyncMeta, SceneMeta } from './meta.js'
import { Factory, FactoryMeta, FactoryChunk } from './factory.js'
import { RESERVED_ATTRIBUTES } from './shared/configs.js'
import { Type } from './ty/type.js'

export class State {
  constructor(options) {
    Object.assign(this, options)
  }
}

const SceneCodesSymbol = Symbol()
const ComputeSymbol = Symbol()

export class Model {
  constructor(data = {}, options = {}) {
    const $this = this
    // const Constructor = getConstructorOf(this)
    const {
      parent,
      key,
      scenes = this._takeSceneCodes(),
    } = options

    define(this, '$$hooks', [])
    define(this, '$$attrs', { ...RESERVED_ATTRIBUTES, ...this._takeAttrs() })
    define(this, '$$state', this._takeState())
    define(this, '$$deps', {})
    define(this, '$$memories', [])
    define(this, '$$scenes', { value: scenes, configurable: true })

    /**
     * create schema
     */
    class Schema extends _Schema {
      constructor(metas) {
        const overrideMetas = $this._takeOverrideMetas()

        const defs = map(metas, (def) => {
          if (!def) {
            return
          }

          if (isInstanceOf(def, Meta) || isInheritedOf(def, Meta)) {
            if (overrideMetas.length) {
              const item = overrideMetas.find(item => isMatchMeta(def, item.meta))
              if (item) {
                return def.extend(item.attrs)
              }
            }
            return def
          }

          if (isObject(def) && inObject('default', def)) {
            const meta = new Meta(def)
            return meta
          }

          /**
           * class SomeModel extends Model {
           *   static some = OtherModel
           * }
           */
          if (isInheritedOf(def, Model)) {
            return Factory.createMeta(def)
          }

          /**
           * class SomeModel extends Model {
           *   static some = [OtherModel, AnyModel]
           * }
           */
          if (isArray(def) && !def.some(def => !isInheritedOf(def, Model))) {
            return Factory.createMeta(def)
          }

          return def
        })

        super(defs)
      }
      onError(e) {
        // dont throw error when generate data when initialize
        if ($this.$init && e.attr === 'create') {
          return
        }
        $this.onError(e)
        $this.emit('error', e)
      }
    }
    // create schema
    let schema = this._takeSchema(Schema)
    // support schema instance or object
    if (!isInstanceOf(schema, _Schema)) {
      schema = map(schema, (meta) => {
        if (isObject(meta) && hasOwnKey(meta, 'default')) {
          return new Meta(meta)
        }
        return meta
      })
      schema = new Schema(schema)
    }
    define(this, '$schema', schema)

    /**
     * process generated metas
     * metas' attributes may be changed dynamicly after schema created
     */

    const metaKeys = Object.keys(this.$schema)

    // switchScene should come before needs check
    const deferers = []
    metaKeys.forEach((metaKey) => {
      const meta = this.$schema[metaKey]
      if (isInstanceOf(meta, AsyncMeta)) {
        // make async attribute enable to notify back
        meta._awaitMeta($this, metaKey, meta)
      }
      else if (scenes && isInstanceOf(meta, SceneMeta)) {
        // make async attribute enable to notify back
        meta._awaitMeta($this, metaKey, meta)
        // switch to new scene
        const deferer = meta.switchScene(scenes)
        deferers.push(deferer)
      }
    })

    // override by _takeOverrideAttrs
    const overrideAttrs = () => {
      const overrides = this._takeOverrideAttrs()
      if (!overrides.length) {
        return
      }
      metaKeys.forEach((metaKey) => {
        const meta = this.$schema[metaKey]
        const item = overrides.find(item => isMatchMeta(meta, item.meta))
        if (!item) {
          return
        }
        Object.assign(meta, item.attrs)
      })
    }

    // check needs() and deps()
    const checkNeeds = () => {
      const needs = []
      const gives = []
      metaKeys.forEach((metaKey) => {
        const meta = this.$schema[metaKey]
        if (isFunction(meta.needs)) {
          needs.push(...meta.needs.call(this, metaKey))
        }
        gives.push(meta)
        // if it is Model, make make visible in gives
        if (isInstanceOf(meta, FactoryMeta)) {
          const entries = meta.$entries
          gives.push(...[].concat(entries))
        }
      })

      if (!needs.length) {
        return
      }

      for (let i = 0, len = needs.length; i < len; i ++) {
        const need = needs[i]
        let flag = false
        for (let j = 0, leng = gives.length; j < leng; j ++) {
          const give = gives[j]
          if (isMatchMeta(give, need)) {
            flag = true
            break
          }
        }
        if (!flag) {
          console.error(need, `is needed, but not given in Model`, $this)
          throw new Error('Dependence is not given, please check dependencies graph.')
        }
      }
    }

    if (deferers.length) {
      Promise.all(deferers).then(() => {
        overrideAttrs()
        checkNeeds()
      })
    }
    else {
      Promise.resolve().then(() => {
        overrideAttrs()
        checkNeeds()
      })
    }

    /**
     * patch nested model properties
     * $root, $parent, $keyPath, $absKeyPath
     */

    // use passed parent
    if (parent && isInstanceOf(parent, Model) && key) {
      this.setParent([parent, key])
    }

    define(this, '$root', () => {
      let parent = this.$parent

      if (!parent) {
        return
      }

      while (parent.$parent) {
        parent = parent.$parent
      }

      return parent
    })

    define(this, '$absKeyPath', () => {
      let parent = this.$parent

      if (!parent) {
        return []
      }

      const path = [...this.$keyPath]

      while (parent && parent.$keyPath) {
        path.unshift(...parent.$keyPath)
        parent = parent.$parent
      }

      return path
    })

    /**
     * create store
     */

    class Store extends _Store {
      _traps(traps) {
        const isNotNeed = (keyPath) => {
          if (keyPath.length !== 1) {
            return true
          }

          const [key] = keyPath
          const meta = $this.$schema[key]
          if (!meta) {
            return true
          }

          if (!isInstanceOf(meta, FactoryMeta)) {
            return true
          }

          const { $entries } = meta
          if (!isArray($entries)) {
            return true
          }
        }

        const inserter = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [key] = keyPath
          const meta = $this.$schema[key]
          const { $entries, $create } = meta

          const nexts = args.filter((item) => {
            if ($entries.some(One => isInstanceOf(item, One))) {
              return true
            }
            if (isObject(item)) {
              return true
            }
            return false
          })
          try {
            const values = $create(nexts, key, $this)
            return values
          }
          catch (e) {
            console.error(e)
          }
        }
        traps.push = inserter
        traps.unshift = inserter

        traps.splice = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [start, count, ...items] = args
          const values = items.length ? inserter(keyPath, items) : []
          return [start, count, ...values]
        }

        traps.fill = (keyPath, args) => {
          if (isNotNeed(keyPath)) {
            return args
          }

          const [value, start, end] = args
          const [key] = keyPath
          const current = $this[key]
          const len = current.length

          // without effects
          if (start && start >= len) {
            return false
          }

          const from = start || 0

          if (end && end <= from) {
            return false
          }

          const to = !end || end > len ? len : end
          const count = to - from

          const items = createArray(value, count)
          const values = inserter(keyPath, items)

          return {
            to: 'splice',
            args: [start, count, ...values],
          }
        }

        const trapGet = traps.get
        traps.get = (keyPath, active) => {
          trapGet(keyPath, active)

          if (!$this.$collection) {
            const deep = []
            let child = $this
            let parent = child.$parent
            let flag = null
            while (parent) {
              const keyPath = child.$keyPath
              deep.unshift(...keyPath)

              if (parent.$collection) {
                flag = parent
                break
              }

              child = parent
              parent = child.$parent
            }
            if (flag) {
              flag.$collection.items.push([deep, $this])
              $this.collect()
            }
          }

          if ($this.$collection && $this.$collection.enable && $this.$collection.fields) {
            $this.$collection.items.push([keyPath, active])
            if (isInstanceOf(active, Model)) {
              active.collect()
            }
          }

          return active
        }

        return traps
      }
      dispatch(keyPath, e, force) {
        const notified = super.dispatch(keyPath, e, force)
        // propagation
        if (notified && $this.$parent && $this.$keyPath && $this.$keyPath[0] !== false) {
          $this.$parent.$store.dispatch([...$this.$keyPath, ...keyPath], e, true)
        }
        return notified
      }
      getContext() {
        return $this
      }
    }
    const store = new Store()
    define(this, '$store', store)

    /**
     * finish
     */

    this.init(data)
    this.emit('init')
    define(this, '$inited', true)

    /**
     * support async onInit
     * i.e.
     *
     * async onInit() {
     *   const options = await this.$schema.some.getOptionsAsync()
     *   this.options = options
     * }
     *
     * async getOptions() {
     *   await this.$ready
     *   return this.options
     * }
     */
    define(this, '$ready', Promise.resolve(this.onInit()))
  }

  _takeOverrideMetas() {
    return []
  }

  /**
   * the same given with _takeOverrideMetas
   * this will force override given attributes, have highest priority
   */
  _takeOverrideAttrs() {
    return []
  }

  _takeSceneCodes() {
    const Constructor = getConstructorOf(this)
    const sceneCodes = []
    const pushSceneCodes = (target) => {
      const unshift = (item) => {
        if (!sceneCodes.includes(item)) {
          sceneCodes.unshift(item)
        }
      }
      if (isArray(target[SceneCodesSymbol])) {
        target[SceneCodesSymbol].forEach(unshift)
      }
      else if (isString(target[SceneCodesSymbol])) {
        unshift(target[SceneCodesSymbol])
      }
    }
    traverseChain(Constructor, Model, pushSceneCodes)
    sceneCodes.reverse()
    return sceneCodes
  }

  _takeSchema() {
    const Constructor = getConstructorOf(this)
    const schema = Constructor.prototype.schema ? Constructor.prototype.schema.call(this) : {}
    // create schema by model's static properties
    const chain = ofChain(this, Model)
    Object.assign(chain, schema)
    return chain
  }

  _takeState() {
    const properties = ofChain(this, Model)
    const Constructor = getConstructorOf(this)
    const state = Constructor.prototype.state ? Constructor.prototype.state.call(this) : {}
    each(properties, (item, key) => {
      // this.state has higher priority
      if (item && isInstanceOf(item, State) && !inObject(key, state)) {
        const { get, set } = item
        if (get || set) {
          define(state, key, {
            get: get && get.bind(this),
            set: set && set.bind(this),
            enumerable: true,
          })
        }
        else {
          state[key] = item.value
        }
      }
    })
    return state
  }

  _takeAttrs() {
    const Constructor = getConstructorOf(this)
    const attrs = Constructor.prototype.attrs ? Constructor.prototype.attrs.call(this) : {}
    return attrs
  }

  init(data = {}) {
    if (this.$ready) {
      return
    }

    const keys = Object.keys(this.$schema)

    // patch keys to this
    keys.forEach((key) => {
      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })
    })

    // views
    const views = {}
    const reactivators = []

    // provide a possibility to check whether during validating
    let validatingQueues = {}
    let cachedErrorsUpdators = {}

    keys.forEach((key) => {
      // patch attributes from meta
      const meta = this.$schema[key]
      // default attributes which will be used by Model/Schema, can not be reset by userself
      const attrs = this.$$attrs
      // define a view
      const view = {}
      // use defineProperties to define view properties
      const viewDef = {}

      if (meta.activate) {
        reactivators.push({ key, activate: meta.activate })
      }

      each(attrs, (fallback, attr) => {
        if (isNull(fallback)) {
          return
        }
        viewDef[attr] = {
          get: () => {
            // use schema prototype methods to determine, so that go though inside logic
            if (typeof RESERVED_ATTRIBUTES[attr] === 'boolean') {
              return this.$schema[attr](key, this.get(key), this)
            }
            return this.$schema.$decide(attr, key, this.get(key), this)(fallback)
          },
          enumerable: true,
        }
      })

      const asyncReactors = {}
      each(meta, (descriptor, attr) => {
        if (inArray(attr[0], ['$', '_'])) {
          return
        }

        if (inObject(attr, attrs)) {
          return
        }

        const { get, set } = descriptor
        if (get || set) {
          viewDef[attr] = {
            get: get && get.bind(this),
            set: set && set.bind(this),
            enumerable: true,
            configurable: true,
          }
        }
        else if (isAsyncRef(descriptor.value)) {
          const { value } = descriptor
          const { current, attach, deps } = value
          let attrValue = current
          // async set attr value
          const get = () => attach.call(this, key, attr).then((next) => {
            if (next === attrValue) {
              return
            }
            const prev = attrValue
            attrValue = next
            this.$store.forceDispatch(`!${key}.${attr}`, next, prev)
          })
          get()
          if (isArray(deps)) {
            deps.map((dep) => {
              if (isInstanceOf(dep, Meta) || isInheritedOf(dep, Meta)) {
                return this.use(dep).key
              }
              return dep
            }).forEach((dep) => {
              asyncReactors[dep] = asyncReactors[dep] || []
              asyncReactors[dep].push(get)
            })
          }
          viewDef[attr] = {
            get: () => {
              if (this.$collection && this.$collection.enable && this.$collection.views) {
                this.$collection.items.push([`!${key}.${attr}`])
              }
              return attrValue
            },
            set: (value) => {
              const prev = attrValue
              attrValue = value
              this.$store.forceDispatch(`!${key}.${attr}`, value, prev)
            },
            enumerable: true,
            configurable: true,
          }
        }
        else if (isMemoRef(descriptor.value)) {
          const { value } = descriptor
          const { getter, compare, depend } = value
          viewDef[attr] = {
            get: () => {
              return this.memo(getter, compare, depend)
            },
            enumerable: true,
            configurable: true,
          }
        }
        // use as a getter
        else if (isFunction(descriptor.value)) {
          const { value } = descriptor
          viewDef[attr] = {
            get: () => {
              const data = getData()
              return value.call(this, data, key)
            },
            enumerable: true,
            configurable: true,
          }
        }
        // patch to view directly
        else {
          const { value } = descriptor
          let attrValue = value
          viewDef[attr] = {
            get: () => {
              if (this.$collection && this.$collection.enable && this.$collection.views) {
                this.$collection.items.push([`!${key}.${attr}`])
              }
              return attrValue
            },
            set: (value) => {
              const prev = attrValue
              attrValue = value
              this.$store.forceDispatch(`!${key}.${attr}`, value, prev)
            },
            enumerable: true,
            configurable: true,
          }
        }
      }, true)
      Object.keys(asyncReactors).forEach((key) => {
        this.watch(key, ({ prev, next }) => {
          if (prev === next) {
            return
          }
          const fns = asyncReactors[key]
          fns.forEach((fn) => fn())
        }, true)
      })

      // unwritable mandatory view properties
      const getData = () => this.getData(key)
      let changed = false // whether the field has changed

      // delcare current key's validatingQueue
      let validatingQueue = []
      validatingQueues[key] = validatingQueue

      // delcare cachedErrors
      let cachedErrors = []
      let cachedErrorsInited = false
      let cachedTimer = null
      let cachedDeferTimer = null
      const setCachedErrors = (errors, silent) => {
        const prev = cachedErrors
        cachedErrors = errors && errors.length ? makeMsg(errors) : []
        if (!silent) {
          this.$store.forceDispatch(`!${key}.errors`, cachedErrors, prev)
        }
      }
      const updateCachedErrors = () => {
        // check asyncly and dispatch
        if (this.$schema[key].validators?.some(item => item.async)) {
          clearTimeout(cachedDeferTimer)
          cachedDeferTimer = setTimeout(() => {
            const deferer = this.$schema.$validateAsync(key, this.get(key), this)([])
            validatingQueue.push(deferer)
          }, 7)
          clearTimeout(cachedTimer)
          cachedTimer = setTimeout(() => {
            Promise.all(validatingQueue)
              // make sure use the latest errors
              .then(list => list.pop())
              .then(setCachedErrors)
              .finally(() => {
                validatingQueue.length = 0
              })
          }, 15)
        }
        // bugfix: fallback, to make UI stable without twinkling
        const errors = this.$schema.$validate(key, this.get(key), this)([])
        // when value change, notification will be send, so make it silent
        setCachedErrors(errors, true)
        cachedErrorsInited = true
      }
      this.watch(key, updateCachedErrors, true)
      this.on('validate', (keys) => keys.includes(key) && updateCachedErrors()) // recompute errors after invoke validate/validateAsync
      cachedErrorsUpdators[key] = updateCachedErrors // NOTICE: it will be used to watch after all fields initialized

      Object.assign(viewDef, {
        key: {
          get: () => key,
          enumerable: true,
        },
        value: {
          get: () => this.get(key),
          set: (value) => this.set(key, value),
          enumerable: true,
        },
        errors: {
          get: () => {
            // before we read `view.errors`, cachedErrors is empty
            // when first get errors, generate cachedErrors
            if (!cachedErrorsInited) {
              updateCachedErrors()
            }
            return cachedErrors
          },
          set: setCachedErrors,
          enumerable: true,
        },
        empty: {
          get: () => this.$schema.empty(key, this.get(key), this),
          enumerable: true,
        },
        data: {
          get: () => getData(),
          enumerable: true,
        },
        text: {
          get: () => this.$schema.format(key, this.getData(key), this),
          enumerable: true,
        },
        state: {
          get: () => {
            const state = meta.state ? meta.state.call(this, key) : {}
            const keys = Object.keys(state)
            const proxy = new Proxy(state, {
              get: (_, key) => inArray(key, keys) ? this.get(key) : undefined,
              set: (_, key, value) => inArray(key, keys) && this.set(key, value),
            })
            return proxy
          },
          enumerable: true,
        },
        absKeyPath: {
          get: () => {
            const absKeyPath = this.$absKeyPath
            return [...absKeyPath, key]
          },
          enumerable: true,
        },
        changed: {
          get: () => changed,
          set: (status) => {
            // make sure the computed field value sync to data
            if (status && meta.compute) {
              this.$store.set(key, view.value, true)
            }

            const prev = changed
            changed = !!status
            if (prev !== changed) {
              this.$store.forceDispatch(`!${key}.changed`, changed, prev)
            }
          },
          enumerable: true,
        },
      })

      Object.defineProperties(view, viewDef)

      define(views, key, {
        get: () => {
          if (this.$collection && this.$collection.enable && this.$collection.views) {
            this.$collection.items.push([`!${key}`])
          }
          return view
        },
        enumerable: true,
      })
    })

    define(this, '$views', views)

    define(this.$views, '$validatings', () => {
      const queues = Object.values(validatingQueues)
      const deferers = flatArray(queues)
      return Promise.all(deferers)
    })

    // create errors, so that is's easy and quick to know the model's current status
    define(this.$views, '$errors', () => {
      const errors = []
      each(views, (view) => {
        errors.push(...view.errors)
      })
      return makeMsg(errors)
    })

    // create changed, so that it's easy to find out whether the data has changed
    define(this.$views, '$changed', {
      get: () => this.collect(() => keys.some((key) => this.$views[key].changed), true),
      set: (status) => this.collect(() => keys.forEach(key => this.$views[key].changed = status), true),
    })

    // create $state, so that it's easy to read state from $views
    define(this.$views, '$state', () => {
      const state = this._combineState()
      const keys = Object.keys(state)
      const output = {}
      keys.forEach((key) => {
        define(output, key, {
          enumerable: true,
          get: () => this[key],
          set: (value) => this[key] = value,
        })
      })
      return output
    })

    // init data
    this._initData(data)

    // make meta.activate work
    const createActivation = (key, activate) => {
      const createWatcher = (dep) => {
        const watcher = () => {
          this.unwatch(dep, watcher)
          const value = createActivation(key, activate)
          this.set(key, value)
        }
        return watcher
      }
      const value = this.collect(() => activate.call(this), (deps) => {
        deps.forEach((dep) => {
          const watcher = createWatcher(dep)
          this.watch(dep, watcher, true)
        })
      })
      return value
    }
    const registerActivator = (activator) => {
      const { key, activate } = activator
      const value = createActivation(key, activate)
      this.reset(key, value)
    }
    reactivators.forEach(registerActivator)

    // register a global listener to watch all changes
    this.watch('*', (e) => {
      const { key, compute } = e
      // root: changed field key
      const root = key[0]
      // changed meta
      const def = this.$schema[root]

      const fields = Object.keys(this.$schema)
      const notifyStateToField = (field) => {
        const { state } = this.$schema[field]
        if (!state) {
          return
        }
        const stateObj = state.call(this, field)
        const stateKeys = Object.keys(stateObj)
        if (stateKeys.includes(root)) {
          this.$store.forceDispatch(`!${field}`, `by state ${root}`)
        }
      }

      if (!def) {
        // if a state changed, should notify fields which depend on it
        if (root in this.$$state) {
          fields.forEach((field) => {
            notifyStateToField(field)
          })
          this.onChange(root)
        }

        return
      }

      // disable for private properties
      if (inArray(key[key.length - 1][0], ['$', '_'])) {
        return
      }

      // response for def.watch attribute
      if (isFunction(def.watch)) {
        def.watch.call(this, e, root)
      }

      fields.forEach((field) => {
        if (root === field) {
          return
        }

        const meta = this.$schema[root]
        const { follow, needs, deps } = this.$schema[field]

        if (isFunction(follow)) {
          const items = follow.call(this, e, field, root)
          if (isArray(items)) {
            items.forEach((item) => {
              const { meta, key = meta, action } = item
              this.use(key, (view) => {
                if (view.key === root) {
                  action.call(this, e, root)
                }
              })
            })
          }
        }

        if (needs) {
          const needMetas = needs.call(this, field)
          if (needMetas.some(item => isMatchMeta(meta, item))) {
            this.$store.forceDispatch(`!${field}`, `needs ${root}`)
            // after dependencies changed, errors should be recompute
            const triggerForErrors = cachedErrorsUpdators[field]
            triggerForErrors()
          }
        }

        if (deps) {
          const depMap = deps.call(this, field)
          if (depMap[root]) {
            this.$store.forceDispatch(`!${field}`, `depends on ${root}`)
            // after dependencies changed, errors should be recompute
            const triggerForErrors = cachedErrorsUpdators[field]
            triggerForErrors()
          }
        }

        notifyStateToField(field)
      })

      /**
       * factors need to traverse to deep subm models
       */
      const traverseToImpact = (model) => {
        const $this = this

        function walk(model, key) {
          const subs = model[key]
          if (isArray(subs)) {
            subs.forEach(impact)
          }
          else {
            impact(subs)
          }
        }

        function impact(sub) {
          if (!isInstanceOf(sub, Model)) {
            return
          }
          const schema = sub.$schema
          const keys = Object.keys(schema)
          keys.forEach((key) => {
            const meta = schema[key]
            if (isInstanceOf(meta, FactoryMeta)) {
              walk(sub, key)
            }
            else {
              const { factors } = meta
              if (!factors) {
                return
              }
              const items = factors.call($this, key)
              const matched = items.find(item => isMatchMeta(def, item))
              if (matched) {
                sub.$store.forceDispatch(`!${key}`, 'by factors', matched)
              }
            }
          })
        }

        impact(model)
      }
      traverseToImpact(this)

      // check $parent
      this._ensure(root)

      // modify view.changed
      if (!compute) {
        this.collect(() => {
          this.$views[root].changed = true
        }, true)
      }

      if (this.$$deps[root]) {
        const { deps, fn } = this.$$deps[root]
        deps.forEach((dep) => {
          this.unwatch(dep, fn)
        })
      }

      this.onChange(root)
    }, true)

    keys.forEach((key) => {
      const meta = this.$schema[key]
      // invoke `init` attribute
      if (meta.init) {
        meta.init.call(this, key)
      }
    })
  }

  _initData(data) {
    this.$initing = true
    this.Chunk().fromJSON(data)
    delete this.$initing
  }

  _initState() {
    const output = {}
    const state = this.$$state
    const combine = (state) => {
      each(state, (descriptor, key) => {
        if (inObject('value', descriptor) && isAsyncRef(descriptor.value)) {
          const { value } = descriptor
          const { current, attach } = value
          output[key] = current

          if (this.$ready) {
            return
          }

          // async set attr value
          attach(key).then((next) => {
            if (this[key] === next) {
              return
            }
            if (this[key] && refineProxy(this[key]) === next) {
              return
            }
            this[key] = next // will trigger watcher
          })

          return
        }

        define(output, key, {
          ...descriptor,
          enumerable: true,
          configurable: true,
        })
      }, true)
    }

    each(this.$schema, (meta, key) => {
      if (!meta.state) {
        return
      }

      const metaState = meta.state.call(this, key)
      if (metaState) {
        combine(metaState)
      }
    })

    // this.state has higher priority
    combine(state)

    return output
  }

  _combineState() {
    const basicState = this.$$state
    const metasState = {}

    each(this.$schema, (meta, key) => {
      if (!meta.state) {
        return
      }

      const metaState = meta.state.call(this, key)
      if (metaState) {
        Object.assign(metasState, metaState)
      }
    })

    const combinedState = {
      ...metasState,
      ...basicState,
    }

    const keys = Object.keys(combinedState)
    const state = {}

    keys.forEach((key) => {
      state[key] = this[key]
    })

    return state
  }

  /**
   * reset property value to be default value
   * @param {*} key
   * @returns
   */
  reset(key, value) {
    if (!key) {
      return this
    }

    if (isInstanceOf(key, Meta) || isInheritedOf(key, Meta)) {
      key = this.use(key, view => view.key)
    }

    if (isUndefined(value)) {
      value = this.$schema.getDefault(key, this)
    }

    this.collect(() => {
      this.set(key, value, true)
      this.use(key, (view) => {
        view.changed = false
      })
    }, true)

    // reset compute
    const def = this.$schema[key]
    if (def[ComputeSymbol]) {
      def.compute = def[ComputeSymbol]
      delete def[ComputeSymbol]
    }

    this.emit('reset')
    return this
  }

  /**
   * only change data of this, without `create` and parse, without dispatch, reset `changed`
   * notice: only properties those which in this will be changed
   * @param {*} data
   * @returns
   */
  patch(data) {
    if (!this.$store.editable) {
      return this
    }

    this.$store.runSilent(() => {
      // reset changed, make sure changed=false after recompute
      this.collect(() => {
        const keys = Object.keys(data)
        keys.forEach((key) => {
          if (!inObject(key, this)) {
            return
          }

          const value = data[key]
          this[key] = value

          if (this.$views[key]) {
            this.$views[key].changed = false
          }
        })
      }, true)
    })

    this.emit('patch')

    return this
  }

  /**
   * reset and cover all data, original model will be clear first, and will use new data to cover the whole model.
   * notice that, properties which are in original model be not in schema may be removed.
   * @param {*} data
   */
  restore(data) {
    if (!this.$store.editable) {
      return this
    }

    const schema = this.$schema
    const state = this._initState()
    const params = {}
    const keys = {} // keys of state and schema and this

    // patch state
    each(state, (descriptor, key) => {
      if (inObject(key, data)) {
        const desc = Object.getOwnPropertyDescriptor(data, key)
        Object.defineProperty(params, key, desc)
      }
      else {
        Object.defineProperty(params, key, descriptor)
      }

      keys[key] = !0

      // redefine state here so that we can invoke this.state() only once when initialize
      define(this, key, {
        get: () => this.get(key),
        set: (value) => this.set(key, value),
        enumerable: true,
        configurable: true,
      })
    }, true)

    // patch fields
    const ensure = (value, key) => {
      if (isArray(value)) {
        value.forEach((item) => ensure(item, key))
      }
      else if (isInstanceOf(value, Model)) {
        value.setParent([this, key])
      }
    }
    const asyncReactors = {}
    each(schema, (meta, key) => {
      const push = (value) => {
        if (!isAsyncRef(value)) {
          params[key] = value
          ensure(value, key)
          return
        }

        const { attach, deps, current } = value
        const get = () => attach(key, 'default').then((next) => {
          if (this[key] === next) {
            return
          }
          if (this[key] && refineProxy(this[key]) === next) {
            return
          }
          this[key] = next // will trigger watcher
        })

        params[key] = current
        ensure(current, key)
        get()

        if (isArray(deps)) {
          deps.map((dep) => {
            if (isInstanceOf(dep, Meta) || isInheritedOf(dep, Meta)) {
              return this.use(dep).key
            }
            return dep
          }).forEach((dep) => {
            asyncReactors[dep] = asyncReactors[dep] || []
            asyncReactors[dep].push(get)
          })
        }
      }

      keys[key] = !0

      if (inObject(key, data)) {
        // disable compute ability
        if (meta.compute) {
          meta[ComputeSymbol] = meta.compute
          delete meta.compute
        }
        // use the value directly
        const value = data[key]
        push(value)
      }
      else {
        // recover compute
        if (meta[ComputeSymbol]) {
          meta.compute = meta[ComputeSymbol]
          delete meta[ComputeSymbol]
        }
        // notice here, we call this in default(), we can get passed state properties
        const value = schema.getDefault(key, this)
        push(value)
      }
    })
    Object.keys(asyncReactors).forEach((key) => {
      this.watch(key, ({ prev, next }) => {
        if (prev === next) {
          return
        }
        const fns = asyncReactors[key]
        fns.forEach((fn) => fn())
      }, true)
    })

    // reset into store
    const initParams = this.onSwitch(params)
    this.emit('switch', initParams)
    this.$store.init(initParams)

    // delete the outdate properties,
    // these properties may be pended by manully by `define`, we should clear them to reset the model
    each(this.$store.state, (_, key) => {
      if (keys[key]) {
        return
      }

      // disable for private properties
      if (inArray(key[0], ['$', '_'])) {
        return
      }

      this.$store.del(key)
      delete this[key]
    }, true)

    // reset changed
    this.$views.$changed = false

    // dependencies collection
    // after onRestore, so that developers can do some thing before collection
    each(schema, (meta, key) => {
      if (meta.compute) {
        this.getData(key)
      }
    })

    // patch those which are not in store but on `this`
    // should must be after previous delete
    this.$store.runSilent(() => {
      each(data, (value, key) => {
        if (keys[key]) {
          return
        }

        // cover those which are on this
        if (inObject(key, this)) {
          this[key] = value
        }
      })
    })

    this.onRestore()
    this.emit('restore', keys)

    return this
  }

  /**
   * get field value, with formatting by `getter`
   * @param {array|string} keyPath
   */
  get(keyPath) {
    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    const value = this.getData(key)
    const transformed = this.$schema.get(key, value, this)
    const output = parse(transformed, chain)

    return output
  }

  /**
   * @param {*} type 0: start, 1: end
   */
  collect(collector, inverse) {
    if (isFunction(collector)) {
      if (inverse === true) { // if true, do not collect deps, and return normal value of collector fn
        if (this.$collection) {
          this.$collection.enable = false
        }
        const res = collector()
        if (this.$collection) {
          this.$collection.enable = true
        }
        return res
      }

      // if function, return value of collector, and exec inverse with deps
      if (isFunction(inverse)) {
        this.collect()
        const res = collector()
        const deps = this.collect(true)
        inverse(deps)
        return res
      }

      // if false, do fn, return deps
      this.collect()
      collector()
      return this.collect(true)
    }

    const summarize = () => {
      const { items } = this.$collection

      const records = []
      items.forEach(([keyPath, value]) => {
        const key = isArray(keyPath) ? makeKeyPath(keyPath, true) : keyPath
        records.push({ key, value })

        if (isInstanceOf(value, Model)) {
          const deps = value.collect(true)
          const keys = deps.map((dep) => {
            const chain = makeKeyChain(dep)
            const key = makeKeyPath([...keyPath, ...chain], true)
            return key
          })
          keys.forEach((key) => {
            records.push({ key, subof: value })
          })
        }
      })

      const res = []
      const push = (key, value) => {
        if (!isFunction(value) && !res.includes(key) && key.split('.').pop() !== 'length') {
          res.push(key)
        }
      }
      let prev = null
      records.forEach((record, i) => {
        if (i === 0 && i !== records.length - 1) {
          prev = record
          return
        }

        const { key, value, subof } = record

        if (prev) {
          const { key: prevKey, value: prevValue } = prev
          if (subof && subof !== prevValue) {
            push(prevKey, prevValue)
          }
          else if (prevKey === key) {
            push(prevKey, prevValue)
          }
          else if (key.indexOf(prevKey) !== 0) {
            push(prevKey, prevValue)
          }
        }

        if (i === records.length - 1) {
          push(key, value)
        }

        prev = record
      })

      return res
    }

    // end, clear, and return deps
    if (collector === true) {
      const collection = this.$collection
      if (!collection) {
        return []
      }

      const keys = summarize()
      const { timer } = collection
      clearTimeout(timer)
      delete this.$collection
      return keys
    }

    // dont start collect again
    if (this.$collection) {
      return summarize
    }

    // start collecting
    const items = []
    const timer = setTimeout(() => this.collect(true), 32)
    define(this, '$collection', {
      value: {
        items,
        // clear automaticly to free memory
        timer,
        enable: true,
        views: collector && typeof collector === 'object' ? collector.views : false,
        fields: collector && typeof collector === 'object' && 'fields' in collector ? collector.fields : true,
      },
      writable: false,
      configurable: true,
    })

    // end before timeout
    return summarize
  }

  /**
   * get a view of field by its keyPath
   * @param {*} keyPath
   * @param {function} fn when keyPath find a view, invoke callback with the view and return as `fn` result
   */
  use(keyPath, fn) {
    if (keyPath && (isInstanceOf(keyPath, Meta) || isInheritedOf(keyPath, Meta))) {
      const keys = Object.keys(this.$schema)
      for (let i = 0, len = keys.length; i < len; i ++) {
        const key = keys[i]
        const meta = this.$schema[key]
        if (isMatchMeta(meta, keyPath)) {
          const view = this.$views[key]
          return view && isFunction(fn) ? fn.call(this, view) : view
        }
      }
      return
    }

    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.pop()

    if (!chain.length) {
      const view = this.$views[key]
      return view && isFunction(fn) ? fn.call(this, view) : view
    }

    const target = parse(this, chain)
    if (isInstanceOf(target, Model)) {
      const view = target.$views[key]
      return view && isFunction(fn) ? fn.call(this, view) : view
    }
  }

  /**
   * use a meta definition to find out view
   * @param {Meta} Meta
   * @param {function} [fn] key => any
   * @returns {view}
   * @example
   * class Some extends Meta {
   *   ...
   * }
   * class Dog extends Meta {
   *   drop() {
   *     const some = this.reflect(Some) || {} // undefined if Some not used
   *     return some.value
   *   }
   * }
   */
  reflect(Meta, fn) {
    return this.use(Meta, fn)
  }

  /**
   * set field value, with `readonly`, `type` checking, and formatting by `setter`
   * @param {array|string} keyPath
   * @param {*} next
   * @param {boolean} force force set, ignore `readonly`
   */
  set(keyPath, next, force) {
    if (!this.$store.editable) {
      return parse(this, keyPath)
    }

    const chain = isArray(keyPath) ? [...keyPath] : makeKeyChain(keyPath)
    const key = chain.shift()

    // deep set
    if (chain.length) {
      const current = this.$store.get(key)
      const cloned = clone(current)
      assign(cloned, chain, next)
      next = cloned
    }

    const def = this.$schema[key]
    if (!def) {
      return this.define(key, next)
    }

    this._check(key)

    const prev = this.$store.get(key)
    const value = force ? this.$schema.$set(key, next, this) : this.$schema.set(key, next, prev, this)
    if (prev !== value && this.$views[key]) {
      this.$views[key].changed = true
    }
    const coming = this.$store.set(key, value)

    // BREAKING CHANGE
    // drop the ability of compute, after change vlaue manully, the field will be a normal field
    if (def.compute) {
      def[ComputeSymbol] = def.compute
      delete def.compute
    }

    this.emit('set', keyPath, coming, prev)

    return coming
  }

  update(data) {
    if (!this.$store.editable) {
      return this
    }

    each(data, (value, key) => {
      // only update existing props, ignore those which are not on model
      // this shakes affects by over-given props
      if (inObject(key, this)) {
        this[key] = value
      }
    })

    this.emit('update')

    return this
  }

  define(key, value) {
    if (!this.$store.editable) {
      return parse(this, key)
    }

    if (this.$schema[key]) {
      return this[key]
    }

    // delete this key
    if (isUndefined(value)) {
      delete this[key]
      this.$store.del(key)
      return
    }

    const def = {
      get: () => this.$store.get(key),
      configurable: true,
      enumerable: true,
    }
    if (!isFunction(value)) {
      def.set = value => this.$store.set(key, value)
    }
    Object.defineProperty(this, key, def)

    const coming = isFunction(value) ? this.$store.define(key, value) : this.$store.set(key, value)

    this.emit('define', key, value)

    return coming
  }

  watch(key, fn, deep) {
    if (isInstanceOf(key, Meta) || isInheritedOf(key, Meta)) {
      key = this.use(key, view => view.key)
    }
    if (!key) {
      return this
    }
    this.$store.watch(key, fn, deep)
    return this
  }

  unwatch(key, fn) {
    if (isInstanceOf(key, Meta) || isInheritedOf(key, Meta)) {
      key = this.use(key, view => view.key)
    }
    this.$store.unwatch(key, fn)
    return this
  }

  validate(key) {
    const errs = this.onCheck(key) || []
    this.emit('check', key, errs)

    const validate = (key, emit) => {
      this._check(key, true)
      const value = this.get(key)
      const outs = decideby(() => {
        // check the given meta validators at first
        const outs = this.$schema.validate(key, value, this)
        if (isArray(value) && !value.some(item => !isInstanceOf(item, Model))) {
          const suberrs = value.map(model => model.validate())
          suberrs.forEach((items, i) => {
            items.forEach((item) => {
              item.key = makeKeyPath([...this.$absKeyPath, key, i, item.key])
              outs.push(item)
            })
          })
          return outs
        }
        if (value && isInstanceOf(value, Model)) {
          const items = value.validate()
          items.forEach((item) => {
            item.key = makeKeyPath([...this.$absKeyPath, key, item.key])
            outs.push(item)
          })
          return outs
        }
        return outs
      })
      const errors = [...errs, ...outs]
      if (emit) {
        this.emit('validate', [key], errors)
      }
      return makeMsg(errors)
    }

    // validate all properties once together
    if (!key || isArray(key)) {
      const keys = !key ? Object.keys(this.$schema) : key
      const groups = keys.map((key) => validate(key))
      const errors = [...errs, ...flatArray(groups)]
      this.emit('validate', keys, errors)
      return makeMsg(errors)
    }

    return validate(key, true)
  }

  validateAsync(key) {
    const errs = this.onCheck(key) || []
    this.emit('check', errs)

    const validate = (key, emit) => {
      this._check(key, true)
      const value = this.get(key)
      const defer = decideby(() => {
        // check the given meta validators at first
        return this.$schema.validateAsync(key, value, this).then((preouts) => {
          const outs = [...preouts]
          if (isArray(value) && !value.some(item => !isInstanceOf(item, Model))) {
            const subdefers = value.map(model => model.validateAsync())
            return Promise.all(subdefers).then((suberrs) => {
              suberrs.forEach((items, i) => {
                items.forEach((item) => {
                  item.key = makeKeyPath([...this.$absKeyPath, key, i, item.key])
                  outs.push(item)
                })
              })
              return outs
            })
          }
          else if (value && isInstanceOf(value, Model)) {
            return value.validateAsync().then((items) => {
              items.forEach((item) => {
                item.key = makeKeyPath([...this.$absKeyPath, key, item.key])
                outs.push(item)
              })
              return outs
            })
          }
          return outs
        })
      })
      return defer.then((outs) => {
        const errors = [...errs, ...outs]
        if (emit) {
          this.emit('validate', [key], errors)
        }
        return makeMsg(errors)
      })
    }

    // validate all properties once together
    if (!key || isArray(key)) {
      const keys = !key ? Object.keys(this.$schema) : key
      return Promise.all(keys.map(key => validate(key))).then((groups) => {
        const errors = [...errs, ...flatArray(groups)]
        this.emit('validate', keys, errors)
        return makeMsg(errors)
      })
    }

    return validate(key, true)
  }

  getData(key) {
    const value = this.$store.get(key)
    const meta = this.$schema[key]
    const view = this.collect(() => this.$views[key], true)

    // if value is changed manully, we will use changed value
    if (view && view.changed) {
      return value
    }
    // if value is not changed, we will use computed value
    else if (meta && meta.compute) {
      // clear all previous dependencies' watchers
      const depent = this.$$deps[key]
      if (depent && depent.deps && depent.deps.length) {
        const { fn, deps } = depent
        deps.forEach((key) => {
          this.unwatch(key, fn)
        })
      }

      // find out new deps
      this.collect()
      const res = tryGet(() => meta.compute.call(this), value)
      const deps = this.collect(true)

      // subscribe new watchers
      if (deps.length) {
        const fn = () => {
          const prev = res
          const value = this.$store.get(key)
          const next = tryGet(() => meta.compute.call(this), value)
          this.$store.dispatch(key, { value: next, next, prev, active: next, invalid: prev, compute: true })
        }
        deps.forEach((key) => {
          this.watch(key, fn, true)
        })
        this.$$deps[key] = { deps, fn }
      }

      // make sure the computed field value sync to data
      this.$store.set(key, res, true)

      return res
    }
    else {
      return value
    }
  }

  _bundleData() {
    const state = this.$store.state
    const schema = this.$schema
    const views = this.$views
    const computed = {}

    each(schema, (meta, key) => {
      if (this.collect(() => views[key] && views[key].changed, true)) {
        return
      }
      if (meta.compute) {
        const value = tryGet(() => meta.compute.call(this), state[key])
        computed[key] = value
      }
    })

    return { ...state, ...computed }
  }

  Chunk(chunk) {
    const Constructor = getConstructorOf(this)
    chunk = chunk || Constructor.Chunk
    const isChunk = chunk && isInstanceOf(chunk, FactoryChunk)

    const checkType = (data, message) => {
      if (isChunk && chunk.type && isInstanceOf(chunk.type, Type)) {
        chunk.type.trace(data).catch((e) => {
          console.error(message, e, data, chunk)
        })
      }
    }

    const fromJSON = (data) => {
      if (isChunk && chunk.fromJSON) {
        const json = chunk.fromJSON(data)
        this.fromJSON(json)
        return
      }
      checkType(data, 'chunk.fromJSON')
      this.fromJSON(data)
    }

    return {
      fromChunk: (...params) => {
        if (isChunk) {
          return Promise.resolve(chunk.data(...params)).then(fromJSON)
        }
        return Promise.reject(new Error('chunk is not a FactoryChunk.'))
      },
      fromJSON,
      toData: () => {
        if (isChunk && chunk.toData) {
          const res = chunk.toData(this)
          const result = this.onExport(res) || res
          this.emit('export', result)
          return result
        }
        return this.toData()
      },
      toJSON: () => {
        if (isChunk && chunk.toJSON) {
          const res = chunk.toJSON(this)
          const result = this.onRecord(res) || res
          this.emit('record', result)
          checkType(result, 'chunk.toJSON')
          return result
        }
        return this.toJSON()
      },
    }
  }

  /**
   * use schema `create` option to generate and restore data
   * @param {*} json
   */
  fromJSON(json) {
    if (!this.$store.editable) {
      return this
    }

    // prepare for sub models
    this.$children = []

    // !!! required, although state will be patch twice, it is required to be set at the first
    // patch state into this, so that we can get passed state in default()
    // dont be worried about reactive, the properties will be override by restore()
    // this make state getter may throw error when the Model inistalize at the first time because of non generated fields
    // so developers should must ensure every situations
    const state = this._initState()
    const patches = map(state, (value, key) => {
      if (inObject(key, json)) {
        return json[key]
      }
      else {
        return value
      }
    })
    Object.assign(this, patches)

    // when new Model, onParse may throw error
    const entry = tryGet(() => this.onParse(json) || json, json)
    this.emit('parse', entry)
    const data = this.$schema.parse(entry, this)
    const next = { ...entry, ...data }

    // if computed properties are not passed in json,
    // we should remove theme from `next`, so that computed properties will be generated automaticly in `restore`
    // if we do not do this, the compute ability will lose because of `restore` logic
    each(this.$schema, (def, key) => {
      const { asset, compute } = def
      const dataKey = asset ? (isFunction(asset) ? asset(entry, key) : asset) : key
      if ((compute || def[ComputeSymbol]) && !inObject(dataKey, entry)) {
        delete next[key]
      }
    })

    this.restore(next)

    // ask children to recompute computed properties
    this.$children.forEach(child => child.onRegress())
    // we do not need $children
    delete this.$children

    // reset changed, make sure changed=false after recompute
    this.$views.$changed = false

    this.emit('fromJSON')
    this.emit('recover')

    return this
  }

  toJSON() {
    this._check()

    const data = clone(this._bundleData()) // original data format
    const output = this.$schema.record(data, this)

    const state = this._combineState()

    const res = {
      ...state,
      ...output,
    }

    const result = this.onRecord(res) || res
    this.emit('record', result)
    return result
  }

  /**
   * update model by passing data, which will use schema `create` attribute to generate value, without dispatch, reset `changed`
   * @param {*} data
   */
  fromJSONPatch(data) {
    if (!this.$store.editable) {
      return
    }

    // prepare for sub models
    this.$children = []

    const output = this.$schema.discover(data, this)

    this.patch(output)

    // ask children to recompute computed properties
    this.$children.forEach(child => child.onRegress())
    // we do not need $children
    delete this.$children

    this.emit('fromJSONPatch')
    this.emit('recover')

    return this
  }

  toData() {
    this._check()
    const data = { ...this } // value format
    const output = this.$schema.export(data, this)
    const result = this.onExport(output) || output
    this.emit('export', result)
    return result
  }

  toParams(determine) {
    const data = this.toData()
    const output = Factory.toParams(data, determine)
    return output
  }

  toFormData(determine) {
    const data = this.toData()
    const formdata = Factory.toFormData(data, determine)
    return formdata
  }

  on(hook, fn) {
    this.$$hooks.push({ hook, fn })
    return this
  }

  off(hook, fn) {
    this.$$hooks.forEach((item, i) => {
      if (hook === item.hook && (isUndefined(fn) || fn === item.fn)) {
        this.$$hooks.splice(i, 1)
      }
    })
    return this
  }

  emit(hook, ...args) {
    this.$$hooks.forEach((item) => {
      if (hook !== item.hook) {
        return
      }
      item.fn.call(this, ...args)
    })
  }

  // when initialized
  onInit() {}
  // before restore model datas
  onSwitch(params) {
    return params
  }
  // parse data before parse, should be override
  onParse(data) {
    return data
  }
  // by toJSON
  onRecord(data) {
    return data
  }
  // serialize data after export, should be override
  onExport(data) {
    return data
  }
  onCheck() {}
  onError() {}
  onEnsure() {}
  onRestore() {}
  onRegress() {}
  onChange(_key) {}

  lock() {
    this.$store.editable = true
    this.emit('lock')
  }

  unlock() {
    this.$store.editable = false
    this.emit('unlock')
  }

  setParent([parent, key]) {
    if (this.$parent && this.$parent === parent && this.$keyPath && this.$keyPath[0] === key) {
      return this
    }

    define(this, '$parent', {
      value: parent,
      writable: false,
      configurable: true,
    })
    define(this, '$keyPath', {
      get: () => {
        const field = parent[key]
        const res = parent.collect(() => {
          if (isArray(field)) {
            const index = field.indexOf(this)
            const keyPath = [key, index]
            if (index === -1) {
              keyPath.unshift(false)
            }
            return keyPath
          }
          else {
            const keyPath = [key]
            if (field !== this) {
              keyPath.unshift(false)
            }
            return keyPath
          }
        }, true)
        return res
      },
      configurable: true,
    })

    // record sub models
    if (parent.$children) {
      parent.$children.push(this)
    }
    // recompute depend on $parent
    else {
      this.onRegress()
    }

    return this
  }

  _ensure(key) {
    const add = (value, key) => {
      if (isInstanceOf(value, Model) && !value.$parent) {
        value.setParent([this, key])
        value.onEnsure(this)
        value.emit('ensure', this)
      }
    }
    const use = (value, key) => {
      if (isArray(value)) {
        value.forEach((item) => add(item, key))
      }
      else {
        add(value, key)
      }
    }

    const root = isArray(key) ? key[0] : key
    const value = this.getData(root)
    use(value, key)
  }

  _check(key, isValidate = false) {
    const schema = this.$schema
    const keys = key ? [key] : Object.keys(schema)

    keys.forEach((key) => {
      // dont check if disabled
      if (this.$schema.disabled(key, this.getData(key), this)) {
        return
      }

      const def = schema[key]
      each(def, (value, attr) => {
        let str = ''
        if (attr === 'validators' && isValidate) {
          value.forEach((item) => {
            each(item, (value) => {
              str += isFunction(value) ? value + '' : ''
            })
          })
        }
        else {
          str += isFunction(value) ? value + '' : ''
        }
        if (str.indexOf('this.$parent') > -1 && !this.$parent) {
          const e = {
            key,
            attr,
            action: '_check $parent',
            message: `this.$parent is called in ${attr}, but current model has no $parent`,
          }
          this.onError(e)
          this.emit('error', e)
        }
      })
    })
  }

  static Edit() {
    const Editor = edit(this)
    return Editor
  }

  Edit(data = {}) {
    const $this = this
    const Constructor = getConstructorOf(this)
    const _Editor = edit(Constructor)

    class Editor extends _Editor {
      init(data) {
        // set parent before restore
        const { $parent, $keyPath } = $this
        if ($parent) {
          this.setParent([$parent, $keyPath[0]])
        }

        super.init(data)
      }
      submit() {
        return super.submit($this)
      }
    }
    const editor = new Editor({ ...this.toJSON(), ...data })
    this.onEdit(editor)
    this.emit('edit', editor)
    return editor
  }

  onEdit() {}

  /**
   * remember a value when using for getter in meta
   * @param {function} getter () => any
   * @param {function} [depend] (value: any) => any, value is the return value of `getter`
   * @param {function} compare (deps: any) => boolean, when `true` use memoried value, when `false` re-compute, deps is the return value of `depend`
   * @returns
   * @example
   * class SomeMeta extends Meta {
   *   static custom_value() {
   *     let count = 0
   *     return this.memo(
   *       () => this.reflect(SomeMeta).value + 12,
   *       (value) => {
   *         count ++
   *         return { value, count }
   *       },
   *       (deps) => deps.count < 10, // when count < 10, use memoried value for each time
   *     )
   *   }
   * }
   */
  memo(getter, compare, depend) {
    const memory = this.$$memories.find(item => item.getter === getter && item.compare === compare)

    if (!memory) {
      const value = getter.call(this)
      const deps = depend ? depend.call(this, value) : null
      this.$$memories.push({
        getter,
        compare,
        depend,
        value,
        deps,
      })
      return value
    }

    const prev = memory.value
    const deps = memory.deps
    const isEqual = compare.call(this, deps)

    if (isEqual) {
      return prev
    }

    const value = getter.call(this)
    memory.value = value
    memory.deps = depend ? depend.call(this, value) : null
    return value
  }

  static Scene(sceneCode) {
    const Constructor = this
    class SceneModel extends Constructor {
      static [SceneCodesSymbol] = isArray(sceneCode) ? sceneCode : [sceneCode]
    }
    return SceneModel
  }
}

function isMatchMeta (give, need) {
  if (give === need) {
    return true
  }

  if (isInheritedOf(need, Meta) && (isInstanceOf(give, need) || isInheritedOf(give, need))) {
    return true
  }

  if (isInstanceOf(need, Model) && isInstanceOf(give, FactoryMeta)) {
    const entries = give.$entries
    if (isArray(entries)) {
      return entries.some(item => item === need)
    }
    else {
      return entries === need
    }
  }

  // meta.extend
  const walk = (meta) => {
    const from = Object.getPrototypeOf(meta)
    if (!from) {
      return false
    }
    if (from === need) {
      return true
    }
    return walk(from)
  }
  return walk(give)
}
