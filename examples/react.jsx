import React from 'react'
import { Model } from 'tyshemo'

class PersonFormModel extends Model {
  schema() {
    return {
      name: {
        type: String,
        default: '',
      },
      age: {
        type: Number,
        default: 0,
        setter: value => !isNaN(+value) ? +value : 0,
        getter: value => value ? value + '' : '',
      },
      height: {
        type: Number,
        default: 0,
        compute() {
          const age = this.data.age
          return age > 0 ? age * 1.5 : 0
        },
        getter: value => value ? value + '' : '',
      },
      tel: {
        type: String,
        default: '',
        validators: [
          {
            validate(value) {
              if (!value) {
                return true
              }
              if (!/^[0-9]/.test(value)) {
                return false
              }
            },
            message() {
              return '{keyPath} should be a string which begin with number.'
            },
          },
        ],
      },
    }
  }
}

export class PersonFormPage extends React.Component {
  constructor(props) {
    super(props)

    this.form = new PersonFormModel()
    // update UI when form changed
    this.form.watch('*', () => {
      this.forceUpdate()
    })

    this.submit = this.submit.bind(this)
    this.reset = this.reset.bind(this)
  }

  submit() {
    const error = this.form.validate()
    if (error) {
      const data = this.form.plaindata()
      // post data to backend api
    }
  }

  reset() {
    // set to default values
    this.form.restore()
  }

  render() {
    const form = this.form

    return <section className="section">
      <div className="container">
        <form>
          <div className="field">
            <label className="label is-small">Name</label>
            <div className="control">
              <input
                className="input is-small"
                name="name"
                value={form.get('name')}
                onInput={e => form.set('name', e.target.value)}
              />
              <p class="help is-danger">{form.message('name')}</p>
            </div>
          </div>
          <div className="field">
            <label className="label is-small">Age</label>
            <div className="control">
              <input
                className="input is-small"
                name="age"
                value={form.get('age')}
                onInput={e => form.set('age', e.target.value)}
              />
              <p class="help is-danger">{form.message('age')}</p>
            </div>
          </div>
          <div className="field">
            <label className="label is-small">Height</label>
            <div className="control">
              <input
                className="input is-small"
                name="height"
                value={form.get('height')}
                disabled
              />
              <p class="help is-danger">{form.message('height')}</p>
            </div>
          </div>

          <div className="field">
            <label className="label is-small">Tel.</label>
            <div className="control">
              <input
                className="input is-small"
                name="tel"
                value={form.get('tel')}
                onInput={e => form.set('tel', e.target.value)}
              />
              <p class="help is-danger">{form.message('tel')}</p>
            </div>
          </div>
          <button className="button is-small" onClick={this.submit}>Submit</button>
          <button className="button is-small" onClick={this.reset}>Reset</button>
        </form>
      </div>
    </section>
  }
}
