/**
 * Zero-dependency, deterministic JSON Schema validator for Agent Contracts.
 * Supports JSON Schema Draft 7 / Draft 2020-12 constructs used in runtime delegation.
 */

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

export function validateJsonSchema(schema: any, data: any, path = '#'): ValidationResult {
  const errors: string[] = []

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] }
  }

  // 1. anyOf handling
  if (Array.isArray(schema.anyOf)) {
    const subResults = schema.anyOf.map((sub: any) => validateJsonSchema(sub, data, path))
    const passed = subResults.some((r: ValidationResult) => r.valid)
    if (!passed) {
      errors.push(`${path}: must match at least one schema in anyOf`)
      return { valid: false, errors }
    }
    return { valid: true, errors: [] }
  }

  // 2. oneOf handling
  if (Array.isArray(schema.oneOf)) {
    const passedCount = schema.oneOf.filter((sub: any) => validateJsonSchema(sub, data, path).valid).length
    if (passedCount !== 1) {
      errors.push(`${path}: must match exactly one schema in oneOf (matched ${passedCount})`)
      return { valid: false, errors }
    }
    return { valid: true, errors: [] }
  }

  // 3. Type check (supports string or array of strings, e.g. ["string", "null"])
  if (schema.type) {
    const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actualType = getJsonType(data)

    const matchesType = allowedTypes.some((t: string) => {
      if (t === 'integer') return Number.isInteger(data)
      if (t === 'number') return typeof data === 'number' && !Number.isNaN(data)
      return actualType === t
    })

    if (!matchesType) {
      errors.push(`${path}: expected type ${allowedTypes.join(' | ')}, got ${actualType}`)
      return { valid: false, errors }
    }
  }

  // 4. Enum validation
  if (Array.isArray(schema.enum)) {
    const matched = schema.enum.some((val: any) => val === data)
    if (!matched) {
      errors.push(`${path}: value ${JSON.stringify(data)} is not in enum [${schema.enum.map((e: any) => JSON.stringify(e)).join(', ')}]`)
    }
  }

  // 5. String constraints
  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) {
      errors.push(`${path}: string length ${data.length} is less than minLength ${schema.minLength}`)
    }
    if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) {
      errors.push(`${path}: string length ${data.length} is greater than maxLength ${schema.maxLength}`)
    }
    if (schema.pattern) {
      try {
        const regex = new RegExp(schema.pattern)
        if (!regex.test(data)) {
          errors.push(`${path}: string does not match pattern "${schema.pattern}"`)
        }
      } catch (err) {
        // Ignore invalid regex in user schema
      }
    }
  }

  // 6. Number constraints
  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) {
      errors.push(`${path}: number ${data} is less than minimum ${schema.minimum}`)
    }
    if (typeof schema.maximum === 'number' && data > schema.maximum) {
      errors.push(`${path}: number ${data} is greater than maximum ${schema.maximum}`)
    }
  }

  // 7. Array validation
  if (Array.isArray(data)) {
    if (typeof schema.minItems === 'number' && data.length < schema.minItems) {
      errors.push(`${path}: array length ${data.length} is less than minItems ${schema.minItems}`)
    }
    if (typeof schema.maxItems === 'number' && data.length > schema.maxItems) {
      errors.push(`${path}: array length ${data.length} is greater than maxItems ${schema.maxItems}`)
    }
    if (schema.uniqueItems === true) {
      const set = new Set(data.map((item: any) => JSON.stringify(item)))
      if (set.size !== data.length) {
        errors.push(`${path}: array items must be unique`)
      }
    }
    if (schema.items) {
      for (let i = 0; i < data.length; i++) {
        const sub = validateJsonSchema(schema.items, data[i], `${path}[${i}]`)
        if (!sub.valid) {
          errors.push(...sub.errors)
        }
      }
    }
  }

  // 8. Object validation
  if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
    // Required properties
    if (Array.isArray(schema.required)) {
      for (const reqKey of schema.required) {
        if (!(reqKey in data) || data[reqKey] === undefined) {
          errors.push(`${path}: missing required property "${reqKey}"`)
        }
      }
    }

    // Properties check
    const properties = schema.properties || {}
    for (const [key, val] of Object.entries(data)) {
      if (properties[key]) {
        const sub = validateJsonSchema(properties[key], val, `${path}.${key}`)
        if (!sub.valid) {
          errors.push(...sub.errors)
        }
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unrecognized additional property "${key}" not allowed`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

function getJsonType(val: any): string {
  if (val === null) return 'null'
  if (Array.isArray(val)) return 'array'
  return typeof val
}
