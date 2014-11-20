
var Promise = require('bluebird');

module.exports = function( options ) {

    var seneca = this,
        senecaProto = Object.getPrototypeOf(seneca);

    senecaProto.actAsync = Promise.promisify(seneca.act);

    senecaProto.readyAsync = Promise.promisify(seneca.ready);

    return 'bluebird'; //necesary?
};

