"use strict";

var seneca  = require('seneca'),
    assert  = require('assert'),
    Promise = require('bluebird'),
    _       = require('lodash');

var si; //will become seneca(), but need to do this in a try/catch to catch internal errors

describe('seneca-bluebird', function() {

    function init_seneca(done) {
        //seneca must .export('Entity')
        try {
            si = seneca({log:'silent'});  

            assert.notEqual(si.export('Entity'), undefined, "seneca must .export('Entity')");

            si.use('..', {prefix:'test'});

            si.ready(function(){
                done();
            });
        } catch(e) {
            done(e);
        }
    }

    before(init_seneca);

    var injected_methods = ['actAsync','addAsync','readyAsync','clientAsync','closeAsync'];

    //injected_methods[] all exist and are typeof function
    function confirmNewMethodSignatures(si) {
        injected_methods.forEach(function(method_name){
            assert.equal(typeof si[method_name], "function", "Expecting method "+method_name+" on seneca.");
        });
    }

    describe('core', function(){ 
        
        it('should create these methods on seneca: '+injected_methods.join(', '), function() {
            confirmNewMethodSignatures(si);
        });
        
        it('readyAsync should resolve a seneca-like object', function(done) {
            si.readyAsync()
                .then(function(si2){
                    confirmNewMethodSignatures(si2);
                    done();
                })
                .catch(done);
        });
        
        it('closeAsync should resolve 1', function(done) {
            si.closeAsync()
                .then(function(one){
                    assert.equal(one, 1);
                    done();
                })
                .catch(done);
        });

    });

    describe('.actAsync with a classic handler [via .add()]', function() {
        //before: init new seneca - we'll be registering handlers
        before(init_seneca);

        before(function(){
            si.add('one:test',function(args, cb) {
                if (args.throwRuntime) {
                    Function({}) //runtime error time!
                }
                if (args.returnErr) {
                    return cb(new Error(args.returnErr));
                }
                cb(null, args.returnData);
            });
        });

        it('should return a promise', function(){
            assert(si.actAsync({one: 'test', returnData:2}) instanceof Promise, ".actAsync did not return a bluebird Promise.");
        });

        it('should resolve a data value correctly', function(){
            var testDataStruct = {
                    result: [
                        'manily...',
                            {important: 'resultings.'}
                    ]
                };
            return si.actAsync({one: 'test', returnData: testDataStruct})
                .then(function(tdata){
                    assert.deepEqual(tdata, testDataStruct);
                });
        });

        it('should reject errors correctly', function() {
            var msg = 'normal error example 1';
            return si.actAsync({one: 'test', returnErr: msg})
                .then(function(){
                    throw new Error("<Not Rejected>");
                }).catch(function(err){
                    assert.equal(err.message, msg);
                });
        });

        it('should reject correctly when runtime errors occur',function(){
            var noErrMsg = "<Runtime error not captured>"
            return si.actAsync({one:'test',throwRuntime:1})
                .then(function(){
                    throw new Error(noErrMsg);
                }).catch(function(err){
                    assert.notEqual(err.message, noErrMsg,'Runtime error not caught');
                });
        });
    });

    describe('.actAsync with a promisified handler [via .addAsync()]', function() {
        //before: init new seneca - we'll be registering handlers
        before(init_seneca);

        before(function(){
            si.addAsync('one:test',function(args) {
                if (args.throwRuntime) {
                    Function({}) //runtime error time!
                }
                return args.returnErr ? 
                    Promise.reject(args.returnErr)
                    : Promise.resolve(args.returnData);
            });
        });

        it('should return a promise', function(){
            assert(si.actAsync({one: 'test', returnData:2}) instanceof Promise, ".actAsync did not return a bluebird Promise.");
        });

        it('should resolve a data value correctly', function(){
            var testDataStruct = {
                    result: [
                        'manily...',
                            {important: 'resultings.'}
                    ]
                };
            return si.actAsync({one: 'test', returnData: testDataStruct})
                .then(function(tdata){
                    assert.deepEqual(tdata, testDataStruct);
                });
        });

        it('should reject errors correctly', function() {
            var msg = 'normal error example 1';
            return si.actAsync({one: 'test', returnErr: msg})
                .then(function(){
                    throw new Error("<Not Rejected>");
                }).catch(function(err){
                    assert.equal(err.message, msg);
                });
        });

        it('should reject correctly when runtime errors occur',function(){
            var noErrMsg = "<Runtime error not captured>"
            return si.actAsync({one:'test',throwRuntime:1})
                .then(function(){
                    throw new Error(noErrMsg);
                }).catch(function(err){
                    assert.notEqual(err.message, noErrMsg,'Runtime error not caught');
                });
        });
    });

    describe('Entities/promisified', function() {
        before(function(done){
            init_seneca(function(){
                si.use('seneca-mem-store');
                si.readyAsync().then(function(){done();});
            });
        });
        beforeEach(function(done){
            return si.readyAsync().then(function(si){
                resetData(si, 'user', _.clone(userData), done);
            });
        });
        var userData = [ { name: "Test Accountson", yob: 1985 }, { name: "Unrest Apison", yob: 2013 } ];

        it('should list$ correctly (all)', function() {
            return si.make('user').list$({})
                .then(function(users){
                    assert.equal(users.length, userData.length);
                    users.forEach(function(user, i){
                        assert.equal(user.name, userData[i].name);
                    });
                });
        });

        it('should list$ correctly (one)', function() {
            return si.make('user').list$({yob: userData[0].yob})
                .then(function(users){
                    assert.equal(users.length, 1);
                    var user = users[0];
                    assert.equal(user.name, userData[0].name);
                });
        });

        it('should list$ correctly (none)', function() {
            return si.make('user').list$({yob: 0})
                .then(function(users){
                    assert.equal(users.length, 0);
                });
        });

        it('should load$ correctly (one)', function() {
            return si.make('user').load$({yob: userData[0].yob})
                .then(function(user){
                    assert.equal(user.name, userData[0].name);
                });
        });

        it('should load$ correctly (none)', function() {
            return si.make('user').load$({yob: 0})
                .then(function(user){
                    assert.equal(null, user);
                });
        });

        it('should save$ correctly (existing)', function() {
            var newName = "-+";
            return si.make('user').load$({name:userData[0].name})
                .then(function(user){
                    user.name = newName;
                    return user.save$();
                }).then(function(user){
                    assert.equal(user.name, newName);
                    assert.equal(user.yob, userData[0].yob);
                });
        });

        it('should save$ correctly (new)', function() {
            var newUser = si.make('user');
            var newUserName = newUser.name = "Test Testerson";
            var newUserYob = newUser.yob = 2100;
            return newUser.save$()
                .then(function(){
                    return si.make('user').load$({name: newUserName})
                }).then(function(user){
                    assert.equal(user.name, newUserName);
                    assert.equal(user.yob, newUserYob);
                });
        });

        it('should remove$ correctly', function() {
            var userData2 = {
                name: 'Some Name',
                yob: userData[0].yob
            };
            var user = si.make('user');
            user.name = userData2.name;
            user.yob = userData2.yob;
            return user.save$().then(function(){
                    return si.make('user').list$({yob:userData[0].yob});
                }).then(function(users){
                    assert.equal(users.length, 2);
                    return si.make('user').remove$({yob: userData[0].yob});
                }).then(function(){
                    return si.make('user').list$({yob: userData[0].yob});
                }).then(function(users){
                    assert.equal(users.length, 1);
                    return si.make('user').remove$({yob: userData[0].yob});
                }).then(function(tdata){
                    return si.make('user').list$({yob: userData[0].yob});
                }).then(function(users){
                    assert.equal(users.length, 0);
                });
        });

        it('should provide native$ correctly', function() {
            return si.make('user').native$()
                .then(function(tdata){
                    assert.equal(typeof tdata, "object");
                    if ( Object.keys(tdata[Object.keys(tdata)[0]]).length < 1 ) {
                        assert.fail(tdata, {undefined:{user:{}}}, 'native not exposed correctly');
                    }
                });
        });

    });

    describe('Entities/classic', function() {
        before(init_seneca);
        before(function(){
            si.use('seneca-mem-store');
            return si.readyAsync();
        });
        beforeEach(function(done){
            return si.readyAsync().then(function(si){
                resetData(si, 'user', {}, done);
            });
        });
        it('list$ should work with a callback', function(done){
            si.make('user').list$({xxa: 23487}, function(err, data) {
                assert.equal(typeof data, 'object');
                assert.equal(data.length, 0);
                done();
            });
        });
        it('load$ should work with a callback', function(done){
            si.make('user').load$({asdkjid: '1293087129837'}, function(err, data) {
                assert.ok(!data);
                done();
            });
        });
        it('save$ should work with a callback', function(done){
            var user = si.make('user');
            user.test = 1;
            var userName = user.name = 'Tasos';
            user.save$(function(err, user) {
                assert.ok(user);
                assert.equal(user.name, userName);
                done();
            });
        });
        it('remove$ should work with a callback', function(done){
            si.make('user').remove$({}, function(err, data) {
                done(err);
            });
        });
        it('native should work with a callback', function(done){
            si.make('user').native$( function(err, tdata) {
                try {
                if (err) return done(err);
                assert(tdata);
                assert.equal(typeof tdata, "object");
                if ( Object.keys(tdata[Object.keys(tdata)[0]]).length < 1 ) {
                    assert.fail(tdata, {undefined:{user:{}}}, 'native not exposed correctly');
                }
                done();
                } catch(e) {
                    return done(e);
                }
            });
        });
    });

    describe('transport', function() {
        it('necessary?');
    });

    //data helpers
    function remove(si, type, count, done) {
        if  (count) {
            si.make('user').remove$({},function(err){
                if(err) 
                    return done(err);
                remove(si, type, --count, done);
            });
        } else {
            done();
        }
    }
    function makeData(si, type, userData, done) {
        if (userData.length) {
            var userInfo = userData.shift();
            var user = si.make('user');
            Object.keys(userInfo).forEach(function(k) {
                user[k] =userInfo[k];
            });
            user.save$(function(err){
                if (err)
                    return done(err);
                return makeData(si, type, userData, done);
            });
        } else {
            done();
        }
    }
    function resetData(si, type, userData, done) {
        si.make(type).list$({},function(err, users){
            remove(si, type, users.length, function(err, data) {
                if (err) 
                    return done(err);
                makeData(si, type, userData, function(err, data){
                    if (err) 
                        return done(err);
                    done();
                });
            });
        });
    }

});
