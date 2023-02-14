import { getIn, setIn } from './object.js'
import { CsvField, JsonField, NestedObject, Path, ValueGetter } from './types.js'

export function getFields(records: NestedObject[]): CsvField[] {
  return collectAllKeys(records).map((key) => ({
    name: key,
    getValue: (item) => item[key]
  }))
}

export function getNestedFields(records: NestedObject[], keySeparator: string = '.'): CsvField[] {
  return collectNestedPaths(records).map((path) => {
    return {
      name: stringifyPath(path, keySeparator),
      getValue: createGetValue(path)
    }
  })
}

export function parseSimpleFieldName(name: string): JsonField {
  return {
    name,
    setValue: (record, value) => {
      record[name] = value
    }
  }
}

export function parseNestedFieldName(name: string, keySeparator = '.'): JsonField {
  const path = parsePath(name, keySeparator)

  if (path.length === 1) {
    // this is no nested field
    return parseSimpleFieldName(path[0])
  }

  return {
    name,
    setValue: (record, value) => {
      setIn(record, path, value)
    }
  }
}

// TODO: unit test
// TODO: stringify array indices differently?
export function stringifyPath(path: Path, keySeparator: string): string {
  return path.map((text) => text.replaceAll(keySeparator, '\\' + keySeparator)).join(keySeparator)
}

// TODO: unit test
export function parsePath(stringifiedPath: string, keySeparator: string): Path {
  return stringifiedPath
    .split(new RegExp('(?<!\\\\)[' + keySeparator + ']'))
    .map((part) => part.replaceAll('\\' + keySeparator, keySeparator))
}

function collectAllKeys(records: NestedObject[]): string[] {
  const keys = new Set<string>()

  records.forEach((record) => {
    Object.keys(record).forEach((key) => keys.add(key))
  })

  return [...keys]
}

function collectNestedPaths(records: NestedObject[]): Path[] {
  const merged: NestedObject = {}

  function mergeRecord(object: NestedObject, merged: NestedObject) {
    for (const key in object) {
      const value = object[key]

      if (isObjectOrArray(value)) {
        if (merged[key] === undefined) {
          merged[key] = {}
        }

        mergeRecord(value as NestedObject, merged[key] as NestedObject)
      } else {
        merged[key] = true
      }
    }
  }

  records.forEach((record) => mergeRecord(record, merged))

  const paths: Path[] = []
  function collectPaths(object: NestedObject, parentPath: string[]) {
    for (const key in object) {
      const path = parentPath.concat(key)
      const value = object[key]

      if (isObjectOrArray(value)) {
        collectPaths(value as NestedObject, path)
      } else {
        paths.push(path)
      }
    }
  }

  collectPaths(merged, [])

  return paths
}

function isObjectOrArray(value: unknown): boolean {
  return typeof value === 'object' && value !== null
}

function createGetValue(path: Path): ValueGetter {
  if (path.length === 1) {
    const key = path[0]
    return (item) => item[key]
  }

  // Note: we could also create optimized functions for 2 and 3 keys,
  // a rough benchmark showed that does not have a significant performance improvement
  // (like only 2% faster or so, and depending a lot on the data structure)

  return (item) => getIn(item, path)
}
