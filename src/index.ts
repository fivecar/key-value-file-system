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

export interface PathValue<T> {
  path: string;
  value: T;
}

export default class KeyValueFileSystem {
  store: KeyValueStore;
  prefix: string;

  constructor(store: KeyValueStore, keyNamespacePrefix = "/kvfs") {
    if (!keyNamespacePrefix.length) {
      throw new Error(
        "keyNamespacePrefix must not be empty. This protects you from\
        accidentally deleting everything else in your store."
      );
    }
    this.store = store;
    this.prefix = keyNamespacePrefix;
  }

  async ls(spec?: string): Promise<readonly string[]> {
    const normalizedSpec = spec || "*";
    const keys = await this.store.getAllKeys();
    const regex = this.regexFromSpec(normalizedSpec);

    return keys
      .filter(key => regex.test(key))
      .map(key => key.slice(this.prefix.length));
  }

  async read<T>(path: string): Promise<T | null> {
    this.validatePath(path);
    const item = await this.store.getItem(this.prefix + path);

    if (item !== null) {
      return JSON.parse(item) as T;
    }
    return item;
  }

  async readMulti<T>(spec: string): Promise<readonly PathValue<T | null>[]> {
    const keys = await this.ls(spec);
    const values = await this.store.multiGet(
      keys.map(key => this.prefix + key)
    );

    return values.map(([path, str]) => {
      const value = str ? (JSON.parse(str) as T) : null;
      return {
        path: path.slice(this.prefix.length),
        value,
      };
    });
  }

  async write<T>(path: string, value: T): Promise<void> {
    this.validatePath(path);
    return await this.store.setItem(this.prefix + path, JSON.stringify(value));
  }

  /**
   * @param basePath The base path to prepend to each subPath in values.
   * @param values Each subPath and object you want written
   */
  async writeMulti<T>(
    basePath: string | undefined,
    values: PathValue<T>[]
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }

    const keyValues = values.map(({ path: subPath, value }): [
      string,
      string
    ] => {
      const fullPath = basePath ? `${basePath}${subPath}` : subPath;

      this.validatePath(fullPath);
      return [this.prefix + fullPath, JSON.stringify(value)];
    });

    return await this.store.multiSet(keyValues);
  }

  async rm(path: string): Promise<void> {
    this.validatePath(path);
    return await this.store.removeItem(this.prefix + path);
  }

  async rmAllForce(): Promise<void> {
    const keys = await this.store.getAllKeys();
    const ourKeys = keys.filter(key => key.startsWith(this.prefix));

    return await this.store.multiRemove(ourKeys);
  }

  private validatePath(path: string): void {
    if (path.length === 0) {
      throw new Error("spec or path must not be empty");
    }
  }

  private regexFromSpec(spec: string): RegExp {
    const segments = [];
    let i = 0;
    let curSegment = "";

    while (i < spec.length) {
      const char = spec[i];

      switch (char) {
        case "\\":
          i++;
          curSegment += spec[i];
          break;
        case "*":
          if (curSegment.length) {
            segments.push(curSegment);
            curSegment = "";
          }
          break;
        default:
          curSegment += char;
          break;
      }
      i++;
    }
    if (curSegment.length) {
      segments.push(curSegment);
    }

    // Escapes all regex special characters, from ES7 proposal
    // https://stackoverflow.com/a/63838890
    const segRegex = segments
      .map(seg => seg.replace(/[.*+\-?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");

    return new RegExp(
      `^${this.prefix}${segRegex}${spec[spec.length - 1] === "*" ? ".*" : ""}$`
    );
  }
}
