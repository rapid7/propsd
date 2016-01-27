class Store {
  constructor() {
    this.store = {};
  }

  set(key, value) {
    this.store[key] = value;
  }

  get(key) {
    return this.store[key];
  }

  keys() {
    return Object.keys(this.store);
  }
}

export default Store;
