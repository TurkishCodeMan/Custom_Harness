import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { extractThoughts } from '../src/thoughts.js'

describe('extractThoughts', () => {
  test('returns original content when no thought tags are present', () => {
    const result = extractThoughts('Hello world', '')
    assert.equal(result.cleanContent, 'Hello world')
    assert.equal(result.finalThinking, '')
  })

  test('extracts <thought> tags into finalThinking and strips from content', () => {
    const raw = '<thought>I should greet the user</thought>Hello user!'
    const result = extractThoughts(raw, '')
    assert.equal(result.cleanContent, 'Hello user!')
    assert.equal(result.finalThinking, 'I should greet the user')
  })

  test('extracts <think> tags (used by DeepSeek / Qwen models)', () => {
    const raw = '<think>Analyzing the user question...</think>\nHere is the answer.'
    const result = extractThoughts(raw, '')
    assert.equal(result.cleanContent, 'Here is the answer.')
    assert.equal(result.finalThinking, 'Analyzing the user question...')
  })

  test('extracts <commentary> tags', () => {
    const raw = '<commentary>Note to self</commentary>Actual message'
    const result = extractThoughts(raw, '')
    assert.equal(result.cleanContent, 'Actual message')
    assert.equal(result.finalThinking, 'Note to self')
  })

  test('combines multiple thought tags and appends to existing thinking', () => {
    const raw = '<think>Step 1</think>intermediate<think>Step 2</think>Done.'
    const result = extractThoughts(raw, 'Prior reasoning')
    assert.equal(result.cleanContent, 'intermediateDone.')
    assert.equal(result.finalThinking, 'Prior reasoning\n\nStep 1\n\nStep 2')
  })

  test('handles empty or falsy inputs gracefully', () => {
    const result = extractThoughts('', '')
    assert.equal(result.cleanContent, '')
    assert.equal(result.finalThinking, '')
  })
})
