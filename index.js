var net = require('net'),
    protobuf = require('protobuf.js'),
    async = require('async');

var messageCodes = {
    '0': 'RpbErrorResp',
    '1': 'RpbPingReq',
    '2': 'RpbPingResp',
    '3': 'RpbGetClientIdReq',
    '4': 'RpbGetClientIdResp',
    '5': 'RpbSetClientIdReq',
    '6': 'RpbSetClientIdResp',
    '7': 'RpbGetServerInfoReq',
    '8': 'RpbGetServerInfoResp',
    '9': 'RpbGetReq',
    '10': 'RpbGetResp',
    '11': 'RpbPutReq',
    '12': 'RpbPutResp',
    '13': 'RpbDelReq',
    '14': 'RpbDelResp',
    '15': 'RpbListBucketsReq',
    '16': 'RpbListBucketsResp',
    '17': 'RpbListKeysReq',
    '18': 'RpbListKeysResp',
    '19': 'RpbGetBucketReq',
    '20': 'RpbGetBucketResp',
    '21': 'RpbSetBucketReq',
    '22': 'RpbSetBucketResp',
    '23': 'RpbMapRedReq',
    '24': 'RpbMapRedResp',
    '25': 'RpbIndexReq',
    '26': 'RpbIndexResp',
    '27': 'RpbSearchQueryReq',
    '28': 'RpbSearchQueryResp'
};
Object.keys(messageCodes).forEach(function (key) {
    messageCodes[messageCodes[key]] = Number(key);
});

function RiakPBC(options) {
    var self = this;
    options = options || {};
    self.host = options.host || 'localhost';
    self.port = options.port || 8087;
    self.bucket = options.bucket || undefined;
    self.translator = protobuf.loadSchema('./spec/riak_kv.proto');
    self.client = new net.Socket();
    self.connected = false;
    self.client.on('end', self.disconnect);
    self.client.on('error', self.disconnect);
    self.client.on('timeout', self.disconnect);
    self.queue = async.queue(function (task, callback) {
        var mc, reply = {};
        var checkReply = function (chunk) {
            splitPacket(chunk).forEach(function (packet) {
                mc = messageCodes['' + packet.readInt8(0)];
                reply = _merge(reply, self.translator.decode(mc, packet.slice(1)));
                if (!task.expectMultiple || reply.done || mc === 'RpbErrorResp') {
                    self.client.removeListener('data', checkReply);
                    task.callback(reply);
                    callback();
                }
            });
        }
        self.client.on('data', checkReply);
        self.client.write(task.message);
    }, 1);

    function splitPacket(pkt) {
        var ret = [];
        while (pkt.length > 0) {
            var len = pkt.readUInt32BE(0),
                buf = new Buffer(len);

            pkt.copy(buf, 0, 4, len + 4);
            ret.push(buf);
            pkt = pkt.slice(len + 4);
        }
        return ret;
    }
};

function _merge(obj1, obj2) {
    var obj = {};
    Object.keys(obj1).forEach(function (key) {
        if (Array.isArray(obj1[key])) {
            if (!obj[key]) obj[key] = [];
            obj[key] = obj[key].concat(obj1[key]);
        } else {
            obj[key] = obj1[key];
        }
    });
    Object.keys(obj2).forEach(function (key) {
        if (Array.isArray(obj2[key])) {
            if (!obj[key]) obj[key] = [];
            obj[key] = obj[key].concat(obj2[key]);
        } else {
            obj[key] = obj2[key];
        }
    });
    return obj;
};

RiakPBC.prototype.makeRequest = function (type, data, callback, expectMultiple) {
    var self = this,
        reply = {},
        buffer = this.translator.encode(type, data),
        message = new Buffer(buffer.length + 5);

    message.writeUInt32BE(buffer.length + 1, 0);
    message.writeInt8(messageCodes[type], 4);
    buffer.copy(message, 5);
    this.connect(function () {
        self.queue.push({ message: message, callback: callback, expectMultiple: expectMultiple });
    });
};

RiakPBC.prototype.getBuckets = function (callback) {
    this.makeRequest('RpbListBucketsReq', null, callback);
};

RiakPBC.prototype.getBucket = function (params, callback) {
    this.makeRequest('RpbGetBucketReq', params, callback);
};

RiakPBC.prototype.setBucket = function (params, callback) {
    this.makeRequest('RpbSetBucketReq', params, callback);
};

RiakPBC.prototype.getKeys = function (params, callback) {
    this.makeRequest('RpbListKeysReq', params, callback, true);
};

RiakPBC.prototype.put = function (params, callback) {
    this.makeRequest('RpbPutReq', params, callback);
};

RiakPBC.prototype.get = function (params, callback) {
    this.makeRequest('RpbGetReq', params, callback);
};

RiakPBC.prototype.del = function (params, callback) {
    this.makeRequest('RpbDelReq', params, callback);
};

RiakPBC.prototype.mapred = function (params, callback) {
    this.makeRequest('RpbMapRedReq', params, callback, true);
};

RiakPBC.prototype.getIndex = function (params, callback) {
    this.makeRequest('RpbIndexReq', params, callback);
};

RiakPBC.prototype.search = function (params, callback) {
    this.makeRequest('RpbSearchQueryReq', params, callback);
};

RiakPBC.prototype.getClientId = function (callback) {
    this.makeRequest('RpbGetClientIdReq', null, callback);
};

RiakPBC.prototype.setClientId = function (params, callback) {
    this.makeRequest('RpbSetClientIdReq', params, callback);
};

RiakPBC.prototype.getServerInfo = function (callback) {
    this.makeRequest('RpbGetServerInfoReq', null, callback);
};

RiakPBC.prototype.ping = function (callback) {
    this.makeRequest('RpbPingReq', null, callback);
};

RiakPBC.prototype.connect = function (callback) {
    if (this.connected) return callback();
    var self = this;
    self.client = net.connect(self.port, self.host, function () {
        self.connected = true;
        callback();
    });
};

RiakPBC.prototype.disconnect = function () {
    if (this.connected) {
        this.connected = false;
        this.client.end();
    }
};

exports.createClient = function (options) {
    return new RiakPBC(options);
};
