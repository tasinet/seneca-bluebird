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
* list$ (in-place; no cb -> promisified)
* load$ (in-place; no cb -> promisified)
* save$ (in-place; no cb -> promisified)
* remove$ (in-place; no cb -> promisified)
* native$ (in-place; no cb -> promisified)

Unfortunately, as of 0.5.21, this can't work with vanilla Seneca and we have to patch one tiny thing.

### Preparing Seneca

Unfortunately, as of 0.5.21, we need to modify lib/seneca.js in order to properly promisify Entities.

We need this to be able to get a reference to Entity object during the seneca-bluebird initialization. This is accomplished by adding 'Entity' to private$.exports, which is then accessed from the plugin through the seneca.export() function.

We provide a patch for lib/seneca.js v. 0.5.21.

1) Copy lib.seneca.0.5.21.js.patch to your seneca/lib/ directory. Chdir into that directory.

2) Execute `patch < lib.seneca.0.5.21.js.patch`

lib/seneca.js MD5sum before:     18f6fc50fbce6b33240e13ffe81bbfc8
lib/seneca.js MD5sum after:      023a9534337d87c0cb9bcb73e304509d

or, just copy the single line changed to your lib/seneca.js yourself.

### Testing

`npm test`

### Usage

```
var si = require('seneca')();

si.use('seneca-bluebird');

//let's register some promisified handlers!

si.addAsync('test:zero', function(args) {
    return Promise.resolve(0);
});
si.addAsync('test:err', function(args) {
    return Promise.reject('Rejection error');
});
si.addAsync('test:err2', function(args) {
    throw new Error("Runtime error!");
});

si.readyAsync()
    .then(function(_seneca){
        si = _seneca;
        return si.actAsync({test:'zero'})   //this will return 0
    })
    .then(function(result){
        assert.equals(result, 0);
        return si.actAsync({test:'err'});   //this will throw
    }).catch(function(err){
        //this will throw 
        assert.equals(err.message,'Rejection error');
        return si.actAsync({test:'err2'})   //this will throw
    }).catch(function(err){
        assert.equals(err.message,'Runtime error!');
    });


