import Model from './model.js'
import {
  define,
  clone,
  parse,
} from 'ts-fns'

export class TracedModel extends Model {
  init(data) {
    let commits = {}
    let history = []
    let cursor = -1
    let doing = false
    define(this, '$commits', {
      get: () => commits,
      set: v => commits = v,
    })
    define(this, '$history', {
      get: () => history,
      set: v => history = v,
    })
    define(this, '$cursor', {
      get: () => cursor,
      set: v => cursor = v,
    })
    define(this, '$do', {
      get: () => doing,
      set: v => doing = v,
    })

    super.init(data)

    // record all changes in history
    this.$store.watch('*', ({ key, value }) => {
      this.$record({ key, value })
    }, true)
  }
  restore(data) {
    super.restore(data)
    this.clear()
    // create a initialized mirror
    this.commit('$origin')
  }

  undo() {
    if (!this.$store.editable) {
      return
    }

    const cursor = this.$cursor - 1

    // no history
    if (cursor < -1 || !this.$history.length) {
      return
    }

    // from history to none
    if (cursor === -1) {
      const origin = this.$commits.$origin
      const current = this.$history[0]
      const { key, data } = current
      if (data) {
        this.$replay({ data: origin })
      }
      else {
        const value = parse(origin, key)
        this.$replay({ key, value })
      }
    }
    else {
      const history = this.$history[cursor]
      this.$replay(history)
    }

    this.$cursor = cursor
  }
  redo() {
    if (!this.$store.editable) {
      return
    }

    const cursor = this.$cursor + 1
    const max = this.$history.length - 1

    if (cursor > max) {
      return
    }

    const history = this.$history[cursor]
    const { key, value, data } = history

    this.$do = true
    if (data) {
      this.$store.update(data)
    }
    else {
      this.$store.set(key, value)
    }
    this.$do = false
    this.$cursor = cursor
  }
  commit(tag) {
    const data = clone(this.$store.data)
    this.$commits[tag] = data
  }
  reset(tag) {
    if (!this.$store.editable) {
      return
    }

    const data = this.$commits[tag]
    if (!data) {
      return
    }

    this.$do = true
    this.$store.update(data)
    this.$do = false
    this.$record({ tag, data })
  }

  $record(action) {
    if (this.$do) {
      return
    }

    const next = this.$cursor + 1
    this.$history.length = next // clear all items after cursor

    if (action.tag) {
      this.$history.push({
        time: Date.now(),
        data: action.data,
        tag: action.tag,
      })
    }
    else {
      const { key, value } = action
      this.$history.push({
        key,
        value,
        time: Date.now(),
      })
    }

    this.$cursor = next // move cursro to next (latest)
  }

  $replay(history) {
    const { key, value, data } = history
    this.$do = true
    if (data) {
      this.$store.update(data)
    }
    else {
      this.$store.set(key, value)
    }
    this.$do = false
  }

  clear() {
    this.$cursor = -1
    this.$history = []
    this.$do = false
  }
}
export default TracedModel
