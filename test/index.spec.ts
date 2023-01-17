import AsyncStorage from "@react-native-async-storage/async-storage";
import KeyValueFileSystem from "../src";

const store = new KeyValueFileSystem(AsyncStorage);
const file = { hello: "world" };

describe("KeyValueStore", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("should require a prefix", () => {
    expect(() => new KeyValueFileSystem(AsyncStorage, "")).toThrow();
  });

  it("should support empty paths for ls", async () => {
    await expect(store.ls()).resolves.not.toThrow();
    await expect(store.ls("")).resolves.not.toThrow();
  });

  it("should refuse empty paths for everything except ls", async () => {
    await expect(store.read("")).rejects.toThrow();
    await expect(store.write("", file)).rejects.toThrow();
    await expect(store.rm("")).rejects.toThrow();
    await expect(
      store.writeMulti("", [{ path: "", value: file }])
    ).rejects.toThrow();
  });

  it("should start as empty", async () => {
    const files = await store.ls("*");

    expect(files).toHaveLength(0);
  });

  it("should write one object", async () => {
    await store.write("/home", file);

    const written = await store.read("/home");
    expect(written).toEqual(file);
  });

  it("should always use prefixes", async () => {
    const tempStore = new KeyValueFileSystem(AsyncStorage, "/test_prefix");
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      tempStore.write("/home", file),
      tempStore.write("/page", file),
    ]);
    const [paths, allKeys] = await Promise.all([
      tempStore.ls("/*"),
      AsyncStorage.getAllKeys(),
    ]);

    expect(paths).toHaveLength(2);
    expect(allKeys).toHaveLength(5);
    expect(allKeys).toEqual(
      expect.arrayContaining([
        ...otherKeys,
        "/test_prefix/home",
        "/test_prefix/page",
      ])
    );
  });

  it("should write nothing when given nothing in writeMulti", async () => {
    await store.writeMulti("/base", []);

    const files = await store.ls("/base");
    expect(files).toHaveLength(0);
  });

  it("should remove all its keys when forced", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/home", file),
      store.write("/page", file),
    ]);
    await store.rmAllForce();
    const [paths, allKeys] = await Promise.all([
      store.ls("/"),
      AsyncStorage.getAllKeys(),
    ]);

    expect(paths).toHaveLength(0);
    expect(allKeys).toHaveLength(otherKeys.length);
    expect(allKeys).toEqual(expect.arrayContaining(otherKeys));
  });

  it("should remove a single file", async () => {
    await store.writeMulti("/base", [
      { path: "/home", value: file },
      { path: "/page", value: file },
    ]);
    await store.rm("/base/home");

    const files = await store.readMulti<typeof file>("/base*");
    expect(files).toHaveLength(1);
    expect(files[0].path).toEqual("/base/page");
    expect(files[0].value).toEqual(file);
  });

  it("should return null for missing files", async () => {
    const missing = await store.read("/home");

    expect(missing).toBeNull();
  });

  it("should handle basic wildcard", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/home", file),
      store.write("/page", file),
    ]);
    const [paths, samePaths, moreSamePaths, allKeys] = await Promise.all([
      store.ls(),
      store.ls("*"),
      store.ls("/*"),
      AsyncStorage.getAllKeys(),
    ]);
    expect(paths.length).toBe(2);
    expect(allKeys).toHaveLength(5);
    expect(allKeys).toEqual(
      expect.arrayContaining([...otherKeys, "/kvfs/home", "/kvfs/page"])
    );
    expect(paths).toEqual(samePaths);
    expect(paths).toEqual(moreSamePaths);
  });

  it("should handle finding tail wildcards", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/foo12", file),
      store.write("/foo24", file),
      store.write("/fom", file),
      store.write("/bar", file),
    ]);
    const paths = await store.ls("/foo*");

    expect(paths).toEqual(expect.arrayContaining(["/foo12", "/foo24"]));
  });

  it("should handle finding mid wildcards", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/baseball", file),
      store.write("/basketball", file),
      store.write("/ball", file),
      store.write("/baller", file),
      store.write("/basketweaving", file),
    ]);
    const paths = await store.ls("/*ball");

    expect(paths).toEqual(
      expect.arrayContaining(["/baseball", "/basketball", "/ball"])
    );
  });

  it("should handle finding mid-and-tail wildcards", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/baseball", file),
      store.write("/basketball", file),
      store.write("/ball", file),
      store.write("/baller", file),
      store.write("/basketweaving", file),
    ]);
    const paths = await store.ls("/*ball*");

    expect(paths).toEqual(
      expect.arrayContaining(["/baseball", "/basketball", "/ball", "/baller"])
    );
  });

  it("should handle deleting with wildcards", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/baseball", file),
      store.write("/basketball", file),
      store.write("/ball", file),
      store.write("/baller", file),
      store.write("/maximumbasketweaving", file),
    ]);
    await store.rm("/*b*s*e*");
    const survivors = await store.ls();

    expect(survivors).toEqual(expect.arrayContaining(["/ball", "/baller"]));
  });

  it("should handle escaping asterisks", async () => {
    await Promise.all([
      store.write("/base**ll", file),
      store.write("/ba*ketball", file),
      store.write("/basketweaving", file),
    ]);
    const paths = await store.ls("/*ba*\\**ll");

    expect(paths).toEqual(expect.arrayContaining(["/base**ll", "/ba*ketball"]));
  });

  it("should handle deleting multiple explicit paths", async () => {
    const otherKeys = ["foo", "bar", "baz"];

    await Promise.all([
      ...otherKeys.map(key => AsyncStorage.setItem(key, "secretstuff")),
      store.write("/baseball", file),
      store.write("/basketball", file),
      store.write("/ball", file),
      store.write("/baller", file),
      store.write("/maximumbasketweaving", file),
    ]);
    await store.rmMulti(["/basketball", "/baller"]);

    const allKeys = await AsyncStorage.getAllKeys();
    expect(allKeys).toEqual(
      expect.arrayContaining([
        ...otherKeys,
        "/kvfs/baseball",
        "/kvfs/ball",
        "/kvfs/maximumbasketweaving",
      ])
    );
  });

  it("should handle deleting an empty set of paths", async () => {
    await Promise.all([
      store.write("/ball", file),
      store.write("/baller", file),
      store.write("/maximumbasketweaving", file),
    ]);
    await store.rmMulti([]);
    const survivors = await store.ls();

    expect(survivors).toEqual(
      expect.arrayContaining(["/ball", "/baller", "/maximumbasketweaving"])
    );
  });
});

