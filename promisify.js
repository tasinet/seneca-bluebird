
var Promise = require('bluebird');
var util = require('util');

module.exports = function( options ) {

    var seneca = this,
        senecaProto = Object.getPrototypeOf(seneca);

    //Required to promisify entity methods. Call early so we fail early if senecajs doesn't support exporting Entity
    var Entity = seneca.export('Entity');
    if (!Entity) {
        seneca.log.fatal("Seneca must be modified to return Entity through .export() before seneca-bluebird can function properly.");
        process.exit(1);
    }

    /** 
     * Core stuff
     *
     * addAsync: register handler which returns promise
     *
     * actAsync: promisified .act()
     *
     * readyAsync: promisified .ready(). Returns seneca
     *
     * clientAsync: promisified .ready()->.client(). Returns client (which is seneca)
     */

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
            this.act.apply(this, args);
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

    senecaProto.closeAsync = function() {
        var q = Promise.pending();
        this.ready(function(err){ 
            err && q.reject(err) || q.resolve(1); //`this` is right: ready cb runs in seneca ctx
        });
        return q.promise;
    };

    senecaProto.clientAsync = function() {
        var args = Array.prototype.slice.apply(arguments);
        return this.readyAsync().then(function(seneca){
            return seneca.client.apply(seneca, args);
        });
    };

    /*
     * Entity stuff
     */

    //var Entity = Entity exported by seneca (up top).

    var entityOverride = {
        fields: [       //these method fields will be promisified
            'save$',
            'native$',
            'load$',
            'list$',
            'remove$',
            //'close$', //not needed after all
        ],
        originalPrefix: '_classic_', //original methods will be prefixed with this
    };

    //override the $entityOverride.fields method fields on Entity.prototype
        //prefix the original fn with entityOverride.originalPrefix
        //replace them with passthrough functions which return promisified version IF cb is missing
            //ASSUMPTION: cb is always last (seems to be the case at this point - v0.5.21)       
    
    entityOverride.fields.forEach(function(originalMethodName){
        var originalReplacementName = entityOverride.originalPrefix + originalMethodName;
        if (typeof Entity.prototype[originalMethodName] !== 'function') { 
            seneca.log.fatal('Entity.prototype.'+originalMethodName+' not found. Mayhaps this is an old version of seneca?');
            process.exit(1);
        }
        if (Entity.prototype[originalReplacementName]) { //this shouldnt exist. Are we being initialized twice? Strange.
            seneca.log.warn('Possible double initialization in seneca-bluebird? (property Entity.prototype.'+originalReplacementName+' was unexpectedly truthy)');
            return;
        }
        Entity.prototype[originalReplacementName] = Entity.prototype[originalMethodName];
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
                    err && q.reject(err) || q.resolve(data);
                };
                args.push(cb);
                this[newName].apply(this, args);
                return q.promise;
            } else
                return this[newName].apply(this, args);
        };
    }

    return 'bluebird';
    
};

