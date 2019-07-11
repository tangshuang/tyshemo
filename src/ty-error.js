export class TyError {
  constructor(info) {
    this.info = info
    this._cache = []
    this.errors = []
  }

  add(error) {
    this.errors.push(error)
  }

  keep(error) {
    this._cache.push(error)
  }
  commit() {
    const error = make(this._cache)
    this.errors.push(error)
    this._cache = []
  }

  count() {
    return this.errors.length
  }

  get error() {
    clearTimeout(this._errorer)
    this._errorer = setTimeout(() => { delete this._error })

    const error = make(this.errors)
    this._error = error
    return error
  }
  get message() {
    clearTimeout(this._messager)
    this._messager = setTimeout(() => { delete this._message })

    if (this._message) {
      return this._message
    }

    const error = this.error()
    const message = this._message || (error ? error.message : '')
    this._message = message
    return message
  }
}

function make(errors) {

}
