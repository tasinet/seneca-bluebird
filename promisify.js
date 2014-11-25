
var Promise = require('bluebird');
var util = require('util');

module.exports = function( options, done ) {

    var seneca = this,
        senecaProto = Object.getPrototypeOf(seneca);

    senecaProto.addAsync = function() {
        var q = Promise.pending(),
            args = Array.prototype.slice.apply(arguments),
            fn = args.pop();

        var newfn = function(args, cb) {
            //console.log('calling on ',typeof fn,'with: ',args);
            try {
                fn.call(seneca, args).then(function(out){
                    cb(null, out);
                }).catch(function(err){
                    if (typeof err == "string") {
                        err = new Error(err);
                    }
                    cb(err);
                });
            } catch(err) { //never called?
                if (err && err.code && !err.message) 
                    err.message = err.code;
                cb(err);
            }
        };
        args.push(newfn);
        //console.log('registering async',args.length, typeof args[0], typeof args[1]);
        this.add.apply(seneca, args);
    };

    senecaProto.actAsync = function(){
        var q = Promise.pending(),
            args = Array.prototype.slice.apply(arguments);
        args.push(function(err, out){
            //console.log('async resolution',err,out);
            err ? q.reject(err) : q.resolve(out);
        });
        try {
            this.act.apply(seneca, args);
        } catch(e) {
            if (e && e.code && !e.message) {
                e.message = e.code;
            }
            q.reject(e);
        }
        return q.promise;
    };

    senecaProto.readyAsync = function(){
        var q = Promise.pending();
        this.ready(function(err){ 
            err && q.reject(err) || q.resolve(this); //`this` is right: ready cb runs in seneca ctx
        });
        return q.promise;
    };

    senecaProto.clientAsync = function() {
        this.readyAsync().then(function(self){
            return self.client();
        });
    };

    var entityOverride = {
        originalPrefix: '_sync_',
        fields: [
            'save$',
            'native$',
            'load$',
            'list$',
            'remove$',
            'close$',
        ],
    };



    var Entity = seneca.export('Entity');
    //override the $entityOverride.fields method fields on Entity.prototype
        //prefix the original fn with entityOverride.originalPrefix
        //replace them with passthrough functions which return promisified version IF cb is missing
            //ASSUMPTION: cb is always last (seems to be the case at this point - v0.5.21)       
    debugger;
    entityOverride.fields.forEach(function(originalMethodName){
        var originalReplacementName = entityOverride.originalPrefix + originalMethodName,
            daFunc = Entity.prototype[originalReplacementName] = Entity.prototype[originalMethodName];
        delete Entity.prototype[originalMethodName];
        Entity.prototype[originalMethodName] = overrideMeMaybe(originalReplacementName);
    });

    function overrideMeMaybe(newName) {
        return function() {
            var args = Array.prototype.slice.apply(arguments),
                lastArg = args.slice(-1);
            if (typeof lastArg !== 'function') {
                var q = Promise.pending();
                var cb = function(err, data) {
                    debugger;
                    err && q.reject(err) || q.resolve(data);
                };
                args.push(cb);
                debugger;
                this[newName].apply(this, args);
                return q.promise;
            } else
                return this[newName].apply(this, args);
        };
    }

    return 'bluebird';
    
};

