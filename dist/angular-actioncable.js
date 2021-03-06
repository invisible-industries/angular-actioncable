var ngActionCable= angular.module('ngActionCable', ['ngWebSocket']);

ngActionCable.factory("ActionCableChannel",function ($q, ActionCableController, ActionCableWebsocket){
  return function(channelName, channelParams){
    this._websocketControllerActions= function(){
      ActionCableController.actions[this.channelName]= ActionCableController.actions[this.channelName] || {};
      ActionCableController.actions[this.channelName][this._channelParamsString]= ActionCableController.actions[this.channelName][this._channelParamsString] || [];
      return ActionCableController.actions[this.channelName][this._channelParamsString];
    }

    this._subscriptionCount= function(){
      return this.callbacks.length;
    }

    this.channelName= channelName;
    this.channelParams= channelParams || {};
    this._channelParamsString= JSON.stringify(this.channelParams);
    this.onMessageCallback= null;
    this.callbacks= this._websocketControllerActions();

    this.subscribe= function(cb){
      var request;
      if (!(typeof(cb)==="function")) {
        console.error("0x01 Callback function was not defined on subscribe(). ActionCable channel: '"+this.channelName+"', params: '"+this._channelParamsString+"'");
        return $q.reject();
      };
      if (this.onMessageCallback) {
        console.error("0x02 This ActionCableChannel instance is already subscribed. ActionCable channel: '"+this.channelName+"', params: '"+this._channelParamsString+"'");
        return $q.reject();
      };
      if (this._subscriptionCount() === 0) { request= ActionCableWebsocket.subscribe(this.channelName, this.channelParams); };
      this._addMessageCallback(cb);
      return (request || $q.resolve());
    }
    this.unsubscribe= function(){
      var request;
      this._removeMessageCallback();
      if (this._subscriptionCount() === 0) { request= ActionCableWebsocket.unsubscribe(this.channelName, this.channelParams); };
      return (request || $q.resolve());
     }
    this.send= function(message, action){
      if (!this.onMessageCallback) {
        console.error("0x03 You need to subscribe before you can send a message. ActionCable channel: '"+this.channelName+"', params: '"+this._channelParamsString+"'");
        return $q.reject();
      };
      return ActionCableWebsocket.send(this.channelName, this.channelParams, message, action);
    }

    this._addMessageCallback= function(cb){
      this.onMessageCallback= cb;
      this.callbacks.push(this.onMessageCallback);
    }

    this._removeMessageCallback= function(){
      for(var i=0; i<this.callbacks.length; i++){
        if (this.callbacks[i]===this.onMessageCallback) {
          this.callbacks.splice(i, 1);
          this.onMessageCallback= null;
          return true;
        }
      }
      console.log("Callbacks:"); console.log(this.callbacks);
      console.log("onMessageCallback:"); console.log(this.onMessageCallback);
      throw "can't find onMessageCallback in callbacks array to remove"
    }
  }
});

// default websocket configs
// looks for Rails' <%= action_cable_meta_tag %> in this format:
// <meta name="action-cable-url" content="ws://localhost:3000/cable"/>
ngActionCable.value('ActionCableConfig', {
    autoStart: true,
    wsUri: angular.element("meta[name='action-cable-url']").attr("content") || "",
    debug: false
  });

ngActionCable.factory('ActionCableController', function () {

  // add a hash of callbacks here that `route_channel` will call on an incoming message.
  // actions format: actions[channelName][dataParams] = [callback1, callback2, ...]
  // e.g. actions["GlobalsData"][JSON.stringify({"responder_id":1})]= [function(message){...}, assignment_2: function(message){...}, ... ]
  var actions = {
    welcome: function(message){
      // console.log('willkommen');
    },
    ping: function(message){
      // console.log('WS ping');
    },
    confirm_subscription: function(message){
      // console.log('WS confirm_subscription on channel: ' + message.identifier);
    },
    ws_404: function(message){
      // console.log('Route not found: ' + message);
    }
  };

  var routeToActions= function(actionCallbacks, message){
    angular.forEach(actionCallbacks, function(func, id){
      func.apply(null, [message]);
    });
  }

  var route = function(message){
    if (!!actions[message.type]) {
      actions[message.type](message);
    } else if (!!findActionCallbacksForChannel(channel_from(message), params_from(message))) {
      var actionCallbacks= findActionCallbacksForChannel(channel_from(message), params_from(message));
      routeToActions(actionCallbacks, message.message);
    } else {
      actions.ws_404(message);
    };
  };


  function findActionCallbacksForChannel(channelName, params){
    return (actions[channelName] && actions[channelName][params]);
  }

  function channel_from(message){
    if (message && message.identifier) {
      return JSON.parse(message.identifier).channel;
    };
  };

  function params_from(message){
    var paramsData= JSON.parse(message.identifier).data;
    return JSON.stringify(paramsData);
  }


  var methods= {
    post: function(message){
      return route(message);
    },
    actions: actions
  };

  return methods;
});

// ngActionCableSocketWrangler to start, stop or try reconnect websockets every intervalTime milliseconds.
//
// Current status is denoted by three booleans:
// connected(), connecting(), and disconnected(), in an abstraction
// of the internal trivalent logic. Exactly one will be true at all times.
//
// Actions are start() and stop()
ngActionCable.factory("ActionCableSocketWrangler", function(ActionCableWebsocket) {
  var intervalTime= 8647;
  var websocket= ActionCableWebsocket;
  var _live= false;
  var _connecting= false;
  var connectNow= function(){
    websocket.attempt_restart();
  };
  var startInterval= function(){
    _connecting= _connecting || setInterval(function(){
      connectNow();
    }, intervalTime);
  };
  var stopInterval= function(){
    clearInterval(_connecting);
    _connecting= false;
  };
  websocket.on_connection_close_callback = function(){
    if (_live) { startInterval(); };
    console.log("close callback");
  };
  websocket.on_connection_open_callback = function(){
    stopInterval();
    console.log("open callback");
  };
  var methods= {
    connected: function(){
      return (_live && !_connecting);
    },
    connecting: function(){
      return (_live && !!_connecting);
    },
    disconnected: function(){
      return !_live;
    },
    start: function(){
      console.info("Live STARTED");
      _live= true;
      startInterval();
      connectNow();
    },
    stop: function(){
      console.info("Live stopped");
      _live= false;
      stopInterval();
      websocket.close();
    }
  };
  return methods;
});

// ActionCable JSON formats:
//
// "identifier" for subscribe, unsubscribe and message must be the same to refer the same subscription!
//
// {
//   "command": "subscribe",
//   "identifier": JSON.stringify({"channel": "UpdatesChannel",  "data": "name"}),
// }
//  - will set params to ["identifier"]["data"]
//
// {
//   "command": "unsubscribe",
//   "identifier": JSON.stringify({"channel": "UpdatesChannel",  "data": "name"}),
// }
//  - will set params to ["identifier"]["data"]
//
// {
//   "command": "message",
//   "identifier": JSON.stringify({"channel": "UpdatesChannel",  "data": "name"}),
//   "data": JSON.stringify({"message": "bla bla", "action": "foobar"})
// }
//  - will call foobar(data)
//  - will set params to ["identifier"]["data"]


ngActionCable.factory("ActionCableWebsocket", function($websocket, ActionCableController, ActionCableConfig) {
  var wsUrl = ActionCableConfig.wsUri;
  var controller = ActionCableController;
  var dataStream = null;
  var methods;
  var connected = false;
  var currentChannels = [];
  var close_connection = function(){
    if (dataStream){
      dataStream.close({"force":true});
      dataStream = null;
      connected = false;
    };
  };
  var subscribe_to = function(channel, data){
    if (typeof(data)==='undefined') data = "N/A";
    console.log("-> subscribing to: " + channel)
    return new_data_stream().send(JSON.stringify({
        "command": "subscribe",
        "identifier": JSON.stringify({"channel": channel, "data": data})
      }));
  };
  var unsubscribe_from = function(channel, data){
    if (typeof(data)==='undefined') data = "N/A";
    console.log("<- unsubscribing from: " + channel)
    return new_data_stream().send(JSON.stringify({
        "command": "unsubscribe",
        "identifier": JSON.stringify({"channel": channel, "data": data})
      }));
  };
  var send_to = function(channel, data, message, action){
    if (typeof(data)==='undefined') data = "N/A";
    console.log("=> sending to: " + channel)
    return new_data_stream().send(JSON.stringify({
        "command": "message",
        "identifier": JSON.stringify({"channel": channel, "data": data}),
        "data": JSON.stringify({"message": message, "action": action})
      }));
  };
  var new_data_stream = function(){
    if(dataStream == null) {
      dataStream = $websocket(wsUrl);
      dataStream.onClose(function(arg){
        close_connection();
        connected = false;
        methods.on_connection_close_callback();
      });
      dataStream.onOpen(function(arg){
        connected = true;
        currentChannels.forEach(function(channel){ subscribe_to(channel.name, channel.data); });
        methods.on_connection_open_callback();
      });
      dataStream.onMessage(function(message) {   //arriving message from backend
        controller.post(JSON.parse(message.data));
      });
    };
    return dataStream;
  };
  methods = {
    connected: function(){ return connected },
    attempt_restart: function(){
      close_connection();
      new_data_stream();
      return true;
    },
    currentChannels: currentChannels,
    close: function(){ return close_connection(); },
    on_connection_close_callback: function(){},
    on_connection_open_callback: function(){},
    subscribe: function(channel, data){
      currentChannels.push({name: channel, data: data});
      return (this.connected() && subscribe_to(channel, data));
    },
    unsubscribe: function(channel, data){
      for(var i=0; i<currentChannels.length; i++){ if (currentChannels[i].name===channel) {currentChannels.splice(i, 1);} }
      return (this.connected() && unsubscribe_from(channel, data));
    },
    send: function(channel, data, message, action){
      console.log("send requested");
      return (this.connected() && send_to(channel, data, message, action));
    }
  };
  return methods;
});
