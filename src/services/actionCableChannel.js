ngActionCable.factory("ActionCableChannel",function (ActionCableController, ActionCableWebsocket){
  return function(channelName, channelParams){
    this._websocketControllerActions= function(){
      var _channelParamsString= JSON.stringify(this.channelParams);
      ActionCableController.actions[this.channelName]= ActionCableController.actions[this.channelName] || {};
      ActionCableController.actions[this.channelName][_channelParamsString]= ActionCableController.actions[this.channelName][_channelParamsString] || [];
      return ActionCableController.actions[this.channelName][_channelParamsString];
    }

    this._subscriptionCount= function(){
      return this.callbacks.length;
    };

    this.channelName= channelName;
    this.channelParams= channelParams || {};
    this.onMessageCallback= null;
    this.callbacks= this._websocketControllerActions();

    this.subscribe= function(cb){
      if (this._subscriptionCount() === 0) { ActionCableWebsocket.subscribe(this.channelName, this.channelParams) };
      this._addMessageCallback(cb);
    }
    this.unsubscribe= function(){
      this._removeMessageCallback();
      if (this._subscriptionCount() === 0) { ActionCableWebsocket.unsubscribe(this.channelName, this.channelParams); };
     }
    this.send= function(message, action){
      ActionCableWebsocket.send(this.channelName, this.channelParams, message, action);
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