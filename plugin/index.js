/* eslint-disable */
"use strict";

var webpack = require("webpack");
var net = require("net");
var SocketIOClient = require("socket.io-client");

function noop() {}

function DashboardPlugin(options) {
  if (typeof options === "function") {
    this.handler = options;
  } else {
    this.options = options || {};
    this.port = options.port || 9838;
    this.handler = options.handler || null;
  }
}

function getCurrentTime() {
  return parseInt((new Date()).getTime() / 1000, 10);
}

function getTimeMessage(timer) {
  return ' (' + (getCurrentTime() - timer) + 's)';
}

DashboardPlugin.prototype.apply = function(compiler) {
  var handler = this.handler;
  const options = this.options;
  var timer;

  if (!handler) {
    handler = noop;
    var port = this.port;
    var host = "127.0.0.1";
    var socket = SocketIOClient("http://" + host + ":" + port);
    socket.on("connect", function() {
      handler = socket.emit.bind(socket, "message");
    });
  }

  compiler.apply(new webpack.ProgressPlugin(function (percent, msg) {
    handler.call(null, [{
      type: "status",
      value: "Compiling"
    }, {
      type: "progress",
      value: percent
    }, {
      type: "operations",
      value: msg + getTimeMessage(timer)
    }]);
  }));

  compiler.plugin("compile", function() {
    timer = getCurrentTime();
    handler.call(null, [{
      type: "status",
      value: "Compiling"
    }]);
  });

  compiler.plugin("invalid", function() {
    handler.call(null, [{
      type: "status",
      value: "Invalidated"
    }, {
      type: "progress",
      value: 0
    }, {
      type: "operations",
      value: "idle"
    }, {
      type: "clear"
    }]);
  });

  compiler.plugin("done", function(stats) {
    var self = this;
    handler.call(null, [{
      type: "status",
      value: "Success"
    }, {
      type: "progress",
      value: 0
    }, {
      type: "operations",
      value: "idle" + getTimeMessage(timer)
    }, {
      type: "stats",
      value: {
        errors: stats.hasErrors(),
        warnings: stats.hasWarnings(),
        data: stats.toJson()
      }
    }]);

    options.plugins.forEach(plugin => {
      if(plugin.onBundleFinish){
        plugin.onBundleFinish(handler.bind(self));
      }
    });
  });

  compiler.plugin("failed", function() {
    handler.call(null, [{
      type: "status",
      value: "Failed"
    }, {
      type: "operations",
      value: "idle" + getTimeMessage(timer)
    }]);
  });

}

module.exports = DashboardPlugin;
