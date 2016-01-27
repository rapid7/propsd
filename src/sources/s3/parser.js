class Parser {
  constructor(input) {
    this._raw = input;
    this._parsed = this.parseBuffer();
  }

  parseBuffer() {
    return this._raw.toString();
  }

  getData() {
    return this._parsed;
  }
}

export default Parser;
