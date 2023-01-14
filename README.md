# key-value-file-system

[![npm package][npm-img]][npm-url]
[![Build Status][build-img]][build-url]
[![Downloads][downloads-img]][downloads-url]
[![Issues][issues-img]][issues-url]
[![Code Coverage][codecov-img]][codecov-url]
[![Commitizen Friendly][commitizen-img]][commitizen-url]
[![Semantic Release][semantic-release-img]][semantic-release-url]

KVFS (key-value-file-system) mimics a basic "file system" of Javascript objects on top of a key value store (e.g. `AsyncStorage`). You end up doing things like:

```Typescript
await store.write("/home/stuff", { rock: "me", amadeus: true});

const filenames = await store.ls("/ho*/*tu*");
filenames.forEach(async name => {
  const obj = await store.read(name);
  console.log("Who to rock?", obj.rock, "And is it Mozart?", obj.amadeus);
});
```

Here are the benefits over using the key-value store directly:
* Direct object support. KVFS reads and writes objects instead of strings. No more `JSON.stringify` and `JSON.parse` all over the place.
* "Hierarchy" support. KVFS defaults to supporting filepaths and the concept of path hierarchies.
* Wildcard support. KVFS has commands like `ls` and `rm` that support wildcards (e.g. `ls(/base*ll/dia*n*`).

## Install

```bash
npm install key-value-file-system
```
or
```bash
yarn add key-value-file-system
```

## API

First create a key value file system, passing it a key/value read/write store:

```Typescript
import AsyncStorage from "@react-native-async-storage/async-storage";
import KVFS from "key-value-file-system";

const store = new KVFS(AsyncStorage);
```

By default, KVFS prepends all your filenames with `"/kvfs"`, so that you can use the same storage for other things unrelated to KVFS. If you want to use a different prefix for all KVFS keys, you can create it this way:

```Typescript
const store = new KVFS(AsyncStorage, "/ILikeThisPrefixBetter");
```

KVFS supports `AsyncStorage` APIs out of the box. But if you're using another type of key-value store, it just needs to conform to this spec:

```Typescript
export interface KeyValueStore {
  getAllKeys(): Promise<readonly string[]>;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(
    keys: readonly string[]
  ): Promise<readonly [string, string | null][]>;
  multiSet(keyValuePairs: Array<[string, string]>): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}
```

### async ls(spec?: string): Promise<readonly string[]>
Lists all filenames if you pass `undefined`, `""`, or `"*"`. Supports wildcards in multiple places (e.g. `ls("/stats/*bowl*/*ing")`).

### async read<T>(path: string): Promise<T | null>

Gives you back the object stored at `path`, or `null` if path doesn't exist.

### async readMulti<T>(spec: string): Promise<readonly PathValue<T | null>[]>

Takes a wildcarded string and gives you back all objects that match.

```Typescript
/* key-value-file-system defines the following:
export interface PathValue<T> {
  path: string;
  value: T;
}
*/
const stuff = await store.readMulti("*69");
stuff.forEach(item => console.log(`At path ${item.path} I found ${path.value}`));
```

### async write<T>(path: string, value: T): Promise<void>

Does what it says on the tin.

### async rm(spec: string): Promise<void>

Takes a wildcard-capable path spec and deletes all objects that match. Note that unlike `ls`, `rm` won't let you just pass nothing. In order to delete everything, you'll either need to `rm("*")` so KVFS knows you're serious, or you can call the next thing.

### rmAllForce(): Promise<void>

The `rm -fr` of KVFS. Removes all KVFS objects. Note that this does NOT delete other keys of yours in the same store — KVFS never messes with keys written by other parts of your app. 


[build-img]:https://github.com/fivecar/key-value-file-system/actions/workflows/release.yml/badge.svg
[build-url]:https://github.com/fivecar/key-value-file-system/actions/workflows/release.yml
[downloads-img]:https://img.shields.io/npm/dt/key-value-file-system
[downloads-url]:https://www.npmtrends.com/key-value-file-system
[npm-img]:https://img.shields.io/npm/v/key-value-file-system
[npm-url]:https://www.npmjs.com/package/key-value-file-system
[issues-img]:https://img.shields.io/github/issues/fivecar/key-value-file-system
[issues-url]:https://github.com/fivecar/key-value-file-system/issues
[codecov-img]:https://codecov.io/gh/fivecar/key-value-file-system/branch/main/graph/badge.svg
[codecov-url]:https://codecov.io/gh/fivecar/key-value-file-system
[semantic-release-img]:https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg
[semantic-release-url]:https://github.com/semantic-release/semantic-release
[commitizen-img]:https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]:http://commitizen.github.io/cz-cli/
