import TraceModel from '../src/trace-model.js'

describe('TraceModel', () => {
  test('undo', () => {
    class Tracer extends TraceModel {
      static name = {
        default: '',
      }
    }

    const editor = new Tracer()
    expect(editor.name).toBe('')

    editor.name = 'text'
    expect(editor.name).toBe('text')

    editor.undo()
    expect(editor.name).toBe('')
  })

  test('redo', () => {
    class Tracer extends TraceModel {
      static name = {
        default: '',
      }
    }

    const editor = new Tracer()
    expect(editor.name).toBe('')

    editor.name = 'text'
    expect(editor.name).toBe('text')

    editor.undo()
    expect(editor.name).toBe('')

    editor.redo()
    expect(editor.name).toBe('text')
  })

  test('commit & reset', () => {
    class Tracer extends TraceModel {
      static name = {
        default: '',
      }
    }

    const editor = new Tracer()
    expect(editor.name).toBe('')

    editor.name = 'text'
    expect(editor.name).toBe('text')
    editor.commit('edit')

    editor.name = 'sss'
    expect(editor.name).toBe('sss')

    editor.reset('edit')
    expect(editor.name).toBe('text')

    editor.undo() // undo reset
    expect(editor.name).toBe('sss')

    editor.redo() // redo reset
    expect(editor.name).toBe('text')
  })
})
