const { EventEmitter } = require("stream");

module.exports = {
  PostgresPoolMock: class PostgresPoolMock extends EventEmitter {
    queryResults = [];
    queryIndex = 0;

    constructor(...args) {
      super();
      this.emit("construct", args);
    }
    reset() {
      this.queryResults = [];
      this.queryIndex = 0;
    }
    setQueryResults(queryResults) {
      this.reset();
      this.queryResults = queryResults;
    }
    query(...args) {
      this.emit("query", { queryIndex: this.queryIndex, args });
      const res = this.queryResults[this.queryIndex];
      if (this.queryIndex === this.queryResults.length) {
        throw new Error(
          "Query is called but there are no more queryResults available"
        );
      } else {
        this.queryIndex++;
      }
      return res;
    }
  },
  getStoreMatchQueriesResults() {
    return [
      { rowCount: 0 },
      {},
      {},
      {},
      {},
      {
        rowCount: 1,
        rows: [
          {
            id: "803adab9-54da-4c73-ac4e-b8ed0937efbe",
          },
        ],
      },
      {},
      {
        rowCount: 1,
        rows: [
          {
            id: "a2306f3d-2559-4ee4-ade8-7ad48fa9ea33",
          },
        ],
      },
      {
        rowCount: 1,
        rows: [
          {
            id: "7417384a-bc4f-41e8-9816-49abcfe3590d",
          },
        ],
      },
      {},
    ];
  },
};
