# seneca-bluebird

### Seneca promisified.

This plugin provides promisified versions of the following seneca methods:

Seneca Core

* seneca.ready -> seneca.readyAsync

* seneca.client -> seneca.clientAsync

* seneca.act -> seneca.actAsync

* seneca.add -> seneca.addAsync

* seneca.close -> seneca.closeAsync (runs .readyAsync as well for convenience)

Seneca Entities

* Entity.list$ (in-place; no cb -> promisified)

* Entity.load$ (in-place; no cb -> promisified)

* Entity.save$ (in-place; no cb -> promisified)

* Entity.remove$ (in-place; no cb -> promisified)

* Entity.native$ (in-place; no cb -> promisified)

Unfortunately, as of 0.5.21, this can't work with vanilla Seneca and we have to patch one tiny thing.

### Preparing Seneca

We need to modify lib/seneca.js in order to properly promisify Entities.

We need this to be able to get a reference to Entity object during the seneca-bluebird initialization. This is accomplished by adding 'Entity' to private$.exports, which is then accessed from the plugin through the seneca.export() function.

We provide a patch for lib/seneca.js v. 0.5.21.

1. Copy lib.seneca.0.5.21.js.patch to your seneca/lib/ directory. Chdir into that directory.

2. Execute `patch < lib.seneca.0.5.21.js.patch`

* lib/seneca.js MD5sum before:     18f6fc50fbce6b33240e13ffe81bbfc8
* lib/seneca.js MD5sum after:      023a9534337d87c0cb9bcb73e304509d

or, just copy the single line changed to your lib/seneca.js yourself.

### Usage

    var assert  = require('assert'),
        Promise = require('bluebird'); 

    var si = require('seneca')();
    //var si = require('seneca')({log:'silent'});   //switch these out to suppress seneca output

    si.use('seneca-bluebird');

    //let's register some promisified handlers!
    //si.addAsync does NOT return a promise; rather it allows for a promise-aware handler to be registered:
    si.addAsync('test:zero', function(args) {
        return Promise.resolve(0);
    });
    // these handlers are completely compatible with both .act and .actAsync
    si.addAsync('test:err', function(args) {
        return Promise.reject('Rejection error');
    });
    //runtime errors are also caught as rejections
    si.addAsync('test:err2', function(args) {
        throw new Error("Runtime error!");
    });

    si.readyAsync().then(function(_seneca){
            si = _seneca;
            return si.actAsync({test:'zero'})   //this will resolve 0
        }).then(function(result){
            assert.equal(result, 0);
            return si.actAsync({test:'err'});   //this will reject
        }).then(function(tdata){
            //this really shouldn't run
            assert.fail(tdata, 'error', 'Should have errored');
        }).catch(function(err){
            //this will throw 
            assert.equal(err.message,'Rejection error');
            return si.actAsync({test:'err2'})   //this will throw, and return as rejection
        }).then(function(tdata){
            //this really shouldn't run
            assert.fail(tdata, 'error', 'Should have errored (2)');
        }).catch(function(err){
            assert.equal(err.message,'Runtime error!');
        }).then(function(){
            console.log('all good');
        }).catch(function(err){
            console.log('unexpected error: ',err);
        });


### Testing

`npm install` in `node_modules/seneca-bluebird`, then:

`npm test`

