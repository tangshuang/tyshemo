import {
  define,
  parse,
  isInstanceOf,
  getConstructorOf,
} from 'ts-fns'

export const EditorSymbol = Symbol('editof')

export function edit(Constructor) {
  class Editor extends Constructor {
    init(data) {
      define(this, '$commits', {
        value: {},
        configurable: true,
      })
      define(this, '$history', {
        value: [],
        configurable: true,
      })
      define(this, '$cursor', {
        value: -1,
        writable: true,
        configurable: true,
      })
      define(this, '$doing', {
        value: false,
        writable: true,
        configurable: true,
      })

      // receive (clone) another model
      if (isInstanceOf(data, Constructor)) {
        data = data.Chunk().toJSON()
        data = this.onEdit(data)
        super.init()
        this.Chunk().fromJSON(data)
      }
      else {
        super.init(data)
      }

      // record all changes in history
      this.watch('*', ({ key, value }) => {
        this.$record({ key, value })
      }, true)
    }

    restore(data) {
      super.restore(data)
      this.clear()
      // create a initialized mirror
      this.commit('$origin')
      return this
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
        else if (key) {
          const value = parse(origin, key)
          this.$replay({ key, value })
        }
      }
      else {
        const history = this.$history[cursor]
        this.$replay(history)
      }

      this.$cursor = cursor

      return this
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
      this.$replay(history)

      this.$cursor = cursor

      return this
    }

    commit(tag = '$origin') {
      const data = this.Chunk().toJSON()
      this.$commits[tag] = data
      return this
    }

    rollback(tag = '$origin') {
      if (!this.$store.editable) {
        return
      }

      const data = this.$commits[tag]
      if (!data) {
        return
      }

      this.$doing = true
      this.Chunk().fromJSON(data)
      this.$doing = false
      this.$record({ tag, data })

      return this
    }

    $record(action) {
      if (this.$doing) {
        return
      }

      const next = this.$cursor + 1
      this.$history.length = next // clear all items after cursor

      const time = Date.now()
      const { tag, data, key, value } = action

      if (tag) {
        this.$history.push({
          time,
          tag,
          data,
        })
      }
      else if (key) {
        this.$history.push({
          time,
          key,
          value,
        })
      }

      this.$cursor = next // move cursro to next (latest)
    }

    $replay(history) {
      const { key, value, data } = history
      this.$doing = true
      if (data) {
        this.$store.update(data)
      }
      else {
        this.$store.set(key, value)
      }
      this.$doing = false
    }

    clear() {
      this.$cursor = -1
      this.$history.length = 0
      this.$doing = false
    }

    submit() {
      const editof = this[EditorSymbol]

      let data = this.Chunk().toJSON()
      data = this.onSubmit(data)

      if (editof) {
        // here we should must ensure model is able to receive current editor's data
        editof.Chunk().fromJSON(data)
        return editof
      }

      const Editor = getConstructorOf(this)
      const Constructor = Editor[EditorSymbol]
      if (Constructor) {
        return new Constructor(data)
      }

      throw new Error(`[TySheMo]: without submit target`)
    }

    onEdit(data) {
      return data
    }

    onSubmit(data) {
      return data
    }

    static [EditorSymbol] = Constructor
  }
  return Editor
}
