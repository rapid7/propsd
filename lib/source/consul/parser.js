'use strict';

/* eslint-disable no-param-reassign */
class Parser {
  constructor() {
    this.properties = {};
    this.nodes = {};
  }

  /**
   * Parse data from the Consul health watcher
   *
   * The health/state endpoint returns an array of Check objects:
   *
   * [
   *  {
   *    "Node": "foobar",
   *    "CheckID": "serfHealth",
   *    "Name": "Serf Health Status",
   *    "Status": "passing",
   *    "Notes": "",
   *    "Output": "",
   *    "ServiceID": "",
   *    "ServiceName": ""
   *  },
   *  {
   *    "Node": "foobar",
   *    "CheckID": "service:redis",
   *    "Name": "Service 'redis' check",
   *    "Status": "passing",
   *    "Notes": "",
   *    "Output": "",
   *    "ServiceID": "redis",
   *    "ServiceName": "redis"
   *  }
   *]
   *
   * The Parser builds a properties structure that looks like
   *
   * {
   *   services: {
   *     <SERVICE_ID>: {
   *       <NODE_ID>: <NODE_ADDRESS>
   *     }
   *   },
   *   nodes: {
   *     <NODE_ID>: {
   *       address: <NODE_ADDRESS>,
   *       passing: <Boolean>,
   *       checks: [Check],
   *       services: {
   *         <SERVICE_ID>: <Boolean>
   *       }
   *     }
   *   }
   * }
   *
   * Where NODE_ADDRESS is a dotted-decimal IPv4 address string. The `services` object
   * is populated only with nodes whose respective checks are passing.
   *
   * @param {Array} checks
   */
  update(checks) {
    const properties = {
      services: {},
      nodes: {}
    };

    checks.forEach((check) => {
      const serviceName = check.ServiceName;
      const nodeID = check.Node;
      const address = this.nodes[nodeID];

      // We don't have a catalog entry for this check's node
      if (!address) { return; }

      if (!properties.nodes[nodeID]) {
        properties.nodes[nodeID] = {
          address,
          passing: true,
          checks: [],
          services: {}
        };
      }

      const services = properties.nodes[nodeID].services;

      properties.nodes[nodeID].checks.push({
        id: check.CheckID,
        name: check.Name,
        notes: check.Notes,
        output: check.Output,
        service: check.ServiceName,
        passing: check.Status === 'passing'
      });

      if (serviceName) {
        // Set a service-check's status. One-or-more failing check -> Not Passing
        if (!services.hasOwnProperty(serviceName)) { services[serviceName] = true; }
        services[serviceName] = (check.Status === 'passing') && services[serviceName];
      } else if (check.Status !== 'passing') {
        // Update the node's global status for a node-check
        properties.nodes[nodeID].passing = false;
      }
    });

    // Iterate over nodes to find passing services
    Object.keys(properties.nodes).forEach((nodeID) => {
      const node = properties.nodes[nodeID];

      // Ignore if any node-checks are failing
      if (!node.passing) { return; }

      Object.keys(node.services).forEach((serviceName) => {
        // Ignore node-services with failing checks
        if (!node.services[serviceName]) { return; }

        if (!properties.services.hasOwnProperty(serviceName)) {
          properties.services[serviceName] = {};
        }

        properties.services[serviceName][nodeID] = node.address;
      });
    });

    this.properties = properties;
  }

  /**
   * Cache the catalog of nodes for address lookup
   *
   * @param  {Array} data An array of node/address tuples from the v1/catalog/nodes endpoint
   */
  catalog(data) {
    this.nodes = data.reduce(function _(nodes, item) {
      nodes[item.Node] = item.Address;

      return nodes;
    }, {});
  }
}

module.exports = Parser;
