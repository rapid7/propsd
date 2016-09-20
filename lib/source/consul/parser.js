'use strict';

/**
 * Consul Parser
 *
 * @class Parser
 */
class Parser {
  /**
   * Constructor
   */
  constructor() {
    this.properties = {};
    this.sources = {};
  }

  /**
   * Parse data from the Consul source. Keys in the data are names of services
   * in Consul. Values in the data are results from Consul's /v1/health/service API.
   *
   * @param {Object} data
   */
  update(data) {
    const properties = {};

    Object.keys(data).forEach((name) => {
      const addresses = [];

      data[name].forEach((info) => {
        // Prefer the service address, not the Consul agent address.
        if (info.Service && info.Service.Address) {
          addresses.push(info.Service.Address);
        } else if (info.Node && info.Node.Address) {
          addresses.push(info.Node.Address);
        }
      });

      properties[name] = {
        cluster: name,
        addresses
      };
    });

    this.properties = properties;
  }
}

module.exports = Parser;
