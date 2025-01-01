import { Mocker } from '../../es/tools/mocker.js'
import { Dict, ifexist, equal, determine, Positive, SelfRef } from '../../es/ty/index.js'

describe('Mocker', () => {
  test('mock', () => {
    const type = new Dict({
      name: String,
      age: Number,
      dog: ifexist(Number),
      sex: equal('M'),
      haul: determine(data => data.sex === 'M', Positive, 0),
    })
    const mocker = new Mocker()
    const data = mocker.mock(type)
    expect(data.haul > 0).toBe(true)
  })
  test('mock selfref', () => {
    const SomeType = new SelfRef((type) => new Dict({
      name: 'ok',
      children: [type],
    }))

    const mocker = new Mocker()
    const data = mocker.mock(SomeType)
    expect(data.name).toBe('ok')
  })
})
