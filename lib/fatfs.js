(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.fatfs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (setImmediate){
var _ = require("./helpers.js");

exports.wrapDriver = function (volume, opts) {
    opts = _.extend({
        maxSectors: 2048
    }, opts);
    
    var cache = {},
        advice = 'NORMAL',
        secSize = volume.sectorSize;
    
    function _freezeBuffer(b) {
        var f = _.allocBuffer(b.length);
        b.copy(f);
        return f;
    }
    
    function addToCache(i, data) {
        if (advice === 'SEQUENTIAL' || advice === 'NOREUSE') return;
        data = _freezeBuffer(data);
        cache[i] = data;
        //if (data.length > secSize) addToCache(i+1, data.slice(secSize));
        while (data.length > secSize) {
            data = data.slice(secSize);
            cache[++i] = data;
        }
        // simple highest-sectors-lose eviction policy for now
        Object.keys(cache).sort().slice(opts.maxSectors).forEach(function (x) {
            delete cache[x];
        });
        _.log(_.log.DBG, "Cache now contains:", Object.keys(cache).join(','));
    }
    
    return {
        sectorSize: volume.sectorSize,
        numSectors: volume.numSectors,
        advice: function (val) {
            if (!arguments.length) return advice;
            else advice = val;
            if (advice === 'SEQUENTIAL' || advice === 'NOREUSE') cache = {};
            return this;
        },
        readSectors: function (i, dest, cb) {
            // TODO: handle having partial parts of dest!
            if (i in cache && dest.length === secSize) {
                cache[i].copy(dest);
                setImmediate(cb);
            } else volume.readSectors(i, dest, function (e) {
                if (e) cb(e);
                else addToCache(i, dest), cb();
            });
        },
        writeSectors: (!volume.writeSectors) ? null : function (i, data, cb) {
            volume.writeSectors(i, data, function (e) {
                if (e) cb(e);
                else addToCache(i, data), cb();
            });
        }
    };
};

}).call(this,require("timers").setImmediate)
},{"./helpers.js":4,"timers":35}],2:[function(require,module,exports){
var S = require("./structs.js"),
    _ = require("./helpers.js");

function _baseChain(vol) {
    var chain = {};
    
    chain.sectorSize = vol._sectorSize;
    
    function posFromOffset(off) {
        var secSize = chain.sectorSize,
            offset = off % secSize,
            sector = (off - offset) / secSize;
        return {sector:sector, offset:offset};
    }
    
    var sectorCache = vol._makeCache();
    Object.defineProperty(chain, 'cacheAdvice', {
        enumerable: true,
        get: function () { return sectorCache.advice(); },
        set: function (v) { sectorCache.advice(v); }
    });
    chain._vol_readSectors = vol._readSectors.bind(vol, sectorCache);
    chain._vol_writeSectors = vol._writeSectors.bind(vol, sectorCache);
    
    // cb(error, bytesRead, buffer)
    chain.readFromPosition = function (targetPos, buffer, cb) {
        if (typeof targetPos === 'number') targetPos = posFromOffset(targetPos);
        if (typeof buffer === 'number') buffer = _.allocBuffer(buffer);
        /* NOTE: to keep our contract with the volume driver, we need to read on _full_ sector boundaries!
                 So we divide the read into [up to] three parts: {preface, main, trailer}
                 This is kind of unfortunate, but in practice should often still be reasonably efficient. */
        if (targetPos.offset) chain.readSectors(targetPos.sector, _.allocBuffer(chain.sectorSize), function (e,d) {
            if (e || !d) cb(e, 0, buffer);
            else {  // copy preface into `buffer`
                var dBeg = targetPos.offset,
                    dEnd = dBeg + buffer.length;
                d.copy(buffer, 0, dBeg, dEnd);
                if (dEnd > d.length) readMain();
                else cb(null, buffer.length, buffer);
            }
        }); else readMain();
        function readMain() {
            var prefaceLen = targetPos.offset && (chain.sectorSize - targetPos.offset),
                trailerLen = (buffer.length - prefaceLen) % chain.sectorSize,
                mainSector = (prefaceLen) ? targetPos.sector + 1 : targetPos.sector,
                mainBuffer = (trailerLen) ? buffer.slice(prefaceLen, -trailerLen) : buffer.slice(prefaceLen);
            if (mainBuffer.length) chain.readSectors(mainSector, mainBuffer, function (e,d) {
                if (e || !d) cb(e, prefaceLen, buffer);
                else if (!trailerLen) cb(null, buffer.length, buffer);
                else readTrailer();
            }); else readTrailer();
            function readTrailer() {
                var trailerSector = mainSector + (mainBuffer.length / chain.sectorSize);
                chain.readSectors(trailerSector, _.allocBuffer(chain.sectorSize), function (e,d) {
                    if (e || !d) cb(e, buffer.length-trailerLen, buffer);
                    else {
                        d.copy(buffer, buffer.length-trailerLen, 0, trailerLen);
                        cb(null, buffer.length, buffer);
                    }
                });
            }
        }
    };
    
    // cb(error)
    chain.writeToPosition = function (targetPos, data, cb) {
        _.log(_.log.DBG, "WRITING", data.length, "bytes at", targetPos, "in", this.toJSON(), data);
        if (typeof targetPos === 'number') targetPos = posFromOffset(targetPos);
        
        var prefaceBuffer = (targetPos.offset) ? data.slice(0, chain.sectorSize-targetPos.offset) : null;
        if (prefaceBuffer) _modifySector(targetPos.sector, targetPos.offset, prefaceBuffer, function (e) {
            if (e) cb(e);
            else if (prefaceBuffer.length < data.length) writeMain();
            else cb();
        }); else writeMain();
        function writeMain() {
            var prefaceLen = (prefaceBuffer) ? prefaceBuffer.length : 0,
                trailerLen = (data.length - prefaceLen) % chain.sectorSize,
                mainSector = (prefaceLen) ? targetPos.sector + 1 : targetPos.sector,
                mainBuffer = (trailerLen) ? data.slice(prefaceLen, -trailerLen) : data.slice(prefaceLen);
            if (mainBuffer.length) chain.writeSectors(mainSector, mainBuffer, function (e) {
                if (e) cb(e);
                else if (!trailerLen) cb();
                else writeTrailer();
            }); else writeTrailer();
            function writeTrailer() {
                var trailerSector = mainSector + (mainBuffer.length / chain.sectorSize),
                    trailerBuffer = data.slice(data.length-trailerLen);     // WORKAROUND: https://github.com/tessel/runtime/issues/721
                _modifySector(trailerSector, 0, trailerBuffer, cb);
            }
        }
        function _modifySector(sec, off, data, cb) {
            chain.readSectors(sec, _.allocBuffer(chain.sectorSize), function (e, orig) {
                if (e) return cb(e);
                orig || (orig = _.allocBuffer(chain.sectorSize, 0));
                //data.copy(orig, off);
                orig.set(data, off); //SEH
                chain.writeSectors(sec, orig, cb);
            });
        }
    };
    
    return chain;
};



exports.clusterChain = function (vol, firstCluster, _parent) {
    var chain = _baseChain(vol),
        cache = [firstCluster];
    
    chain.firstCluster = firstCluster;
    
    function _cacheIsComplete() {
        return cache[cache.length-1] === 'eof';
    }
    
    function extendCacheToInclude(i, cb) {          // NOTE: may `cb()` before returning!
        if (i < cache.length) cb(null, cache[i]);
        else if (_cacheIsComplete()) cb(null, 'eof');
        else vol.fetchFromFAT(cache[cache.length-1], function (e,d) {
            if (e) cb(e);
            else if (typeof d === 'string' && d !== 'eof') cb(S.err.IO());
            else {
                cache.push(d);
                extendCacheToInclude(i, cb);
            }
        });
    }
    
    function expandChainToLength(clusterCount, cb) {
        if (!_cacheIsComplete()) throw Error("Must be called only when cache is complete!");
        else cache.pop();            // remove 'eof' entry until finished
        
        function addCluster(clustersNeeded, lastCluster) {
            if (!clustersNeeded) cache.push('eof'), cb();
            else vol.allocateInFAT(lastCluster, function (e, newCluster) {
                if (e) cb(e);
                else vol.storeToFAT(lastCluster, newCluster, function (e) {
                    if (e) return cb(e);
                    
                    cache.push(newCluster);
                    addCluster(clustersNeeded-1, newCluster);
                });
            });
        }
        addCluster(clusterCount - cache.length, cache[cache.length - 1]);
    }
    
    function shrinkChainToLength(clusterCount, cb) {
        if (!_cacheIsComplete()) throw Error("Must be called only when cache is complete!");
        else cache.pop();            // remove 'eof' entry until finished
        
        function removeClusters(count, cb) {
            if (!count) cache.push('eof'), cb();
            else vol.storeToFAT(cache.pop(), 'free', function (e) {
                if (e) cb(e);
                else removeClusters(count - 1, cb);
            });
        }
        // NOTE: for now, we don't remove the firstCluster ourselves; we should though!
        if (clusterCount) removeClusters(cache.length - clusterCount, cb);
        else removeClusters(cache.length - 1, cb);
    }
    
    // [{firstSector,numSectors},{firstSector,numSectors},…]
    function determineSectorGroups(sectorIdx, numSectors, alloc, cb) {
        var sectorOffset = sectorIdx % vol._sectorsPerCluster,
            clusterIdx = (sectorIdx - sectorOffset) / vol._sectorsPerCluster,
            numClusters = Math.ceil((numSectors + sectorOffset) / vol._sectorsPerCluster),
            chainLength = clusterIdx + numClusters;
        extendCacheToInclude(chainLength-1, function (e,c) {
            if (e) cb(e);
            else if (c === 'eof' && alloc) expandChainToLength(chainLength, function (e) {
                if (e) cb(e);
                else _determineSectorGroups();
            });
            else _determineSectorGroups();
        });
        function _determineSectorGroups() {
            // …now we have a complete cache
            var groups = [],
                _group = null;
            for (var i = clusterIdx; i < chainLength; ++i) {
                var c = (i < cache.length) ? cache[i] : 'eof';
                if (c === 'eof') break;
                else if (_group && c !== _group._nextCluster) {
                    groups.push(_group);
                    _group = null;
                }
                if (!_group) _group = {
                   _nextCluster: c+1,
                   firstSector: vol._firstSectorOfCluster(c) + sectorOffset,
                   numSectors: vol._sectorsPerCluster - sectorOffset
                }; else {
                    _group._nextCluster += 1;
                    _group.numSectors += vol._sectorsPerCluster;
                }
                sectorOffset = 0;       // only first group is offset
            }
            if (_group) groups.push(_group);
            cb(null, groups, i === chainLength);
        }
    }
    
    chain.readSectors = function (i, dest, cb) {
        var groupOffset = 0, groupsPending;
        determineSectorGroups(i, dest.length / chain.sectorSize, false, function (e, groups, complete) {
            if (e) cb(e);
            else if (!complete) groupsPending = -1, _pastEOF(cb);
            else if ((groupsPending = groups.length)) groups.forEach(function (group) {
                var groupLength = group.numSectors * chain.sectorSize,
                    groupBuffer = dest.slice(groupOffset, groupOffset += groupLength);
                chain._vol_readSectors(group.firstSector, groupBuffer, function (e,d) {
                    if (e && groupsPending !== -1) groupsPending = -1, cb(e);
                    else if (--groupsPending === 0) cb(null, dest);
                });
            });
            else cb(null, dest);     // 0-length destination case
        });
    };
    
    // TODO: does this handle NOSPC condition?
    chain.writeSectors = function (i, data, cb) {
        var groupOffset = 0, groupsPending;
        determineSectorGroups(i, data.length / chain.sectorSize, true, function (e, groups) {
            if (e) cb(e);
            else if ((groupsPending = groups.length)) groups.forEach(function (group) {
                var groupLength = group.numSectors * chain.sectorSize,
                    groupBuffer = data.slice(groupOffset, groupOffset += groupLength);
                chain._vol_writeSectors(group.firstSector, groupBuffer, function (e) {
                    if (e && groupsPending !== -1) groupsPending = -1, cb(e);
                    else if (--groupsPending === 0) cb();
                });
            });
            else cb();     // 0-length data case
        });
    };
    
    chain.truncate = function (numSectors, cb) {
        extendCacheToInclude(Infinity, function (e,c) {
            if (e) return cb(e);
            
            var currentLength = cache.length-1,
                clustersNeeded = Math.ceil(numSectors / vol._sectorsPerCluster);
            if (clustersNeeded < currentLength) shrinkChainToLength(clustersNeeded, cb);
            else if (clustersNeeded > currentLength) expandChainToLength(clustersNeeded, cb);
            else cb();
        });
    };
    
    
    chain.toJSON = function () {
        return {firstCluster:firstCluster};
    };
    
    return chain;
};

exports.sectorChain = function (vol, firstSector, numSectors) {
    var chain = _baseChain(vol);
    
    chain.firstSector = firstSector;
    chain.numSectors = numSectors;
    
    chain.readSectors = function (i, dest, cb) {
        if (i < numSectors) chain._vol_readSectors(firstSector+i, dest, cb);
        else _pastEOF(cb);
    };
    
    chain.writeSectors = function (i, data, cb) {
        if (i < numSectors) chain._vol_writeSectors(firstSector+i, data, cb);
        else _.delayedCall(cb, S.err.NOSPC());
    };
    
    chain.truncate = function (i, cb) {
        _.delayedCall(cb, S.err.INVAL());
    };
    
    chain.toJSON = function () {
        return {firstSector:firstSector, numSectors:numSectors};
    };
    
    return chain;
};

// NOTE: used with mixed feelings, broken out to mark uses
function _pastEOF(cb) { _.delayedCall(cb, null, null); }

},{"./helpers.js":4,"./structs.js":38}],3:[function(require,module,exports){
var S = require("./structs.js"),
    _ = require("./helpers.js");

var dir = exports;

dir.iterator = function (dirChain, opts) {
    opts || (opts = {});
    
    var cache = {buffer:null, n: null};
    function getSectorBuffer(n, cb) {
        if (cache.n === n) cb(null, cache.buffer);
        else cache.n = cache.buffer = null, dirChain.readSectors(n, _.allocBuffer(dirChain.sectorSize), function (e,d) {
            if (e) cb(e);
            else if (!d) return cb(null, null);
            else {
                cache.n = n;
                cache.buffer = d;
                getSectorBuffer(n, cb);
            }
        });
    }
    
    var secIdx = 0,
        off = {bytes:0},
        long = null;
    function getNextEntry(cb) {
        if (off.bytes >= dirChain.sectorSize) {
            secIdx += 1;
            off.bytes -= dirChain.sectorSize;
        }
        var entryPos = {chain:dirChain, sector:secIdx, offset:off.bytes};
        getSectorBuffer(secIdx, function (e, buf) {
            if (e) return cb(S.err.IO());
            else if (!buf) return cb(null, null, entryPos);
            
            var entryIdx = off.bytes,
                signalByte = buf[entryIdx];
            if (signalByte === S.entryDoneFlag) return cb(null, null, entryPos);
            else if (signalByte === S.entryFreeFlag) {
                off.bytes += S.dirEntry.size;
                long = null;
                if (opts.includeFree) return cb(null, {_free:true,_pos:entryPos}, entryPos);
                else return getNextEntry(cb);       // usually just skip these
            }
            
            var attrByte = buf[entryIdx+S.dirEntry.fields.Attr.offset],
                entryType = (attrByte === S.longDirFlag) ? S.longDirEntry : S.dirEntry_simple;
            var entry = entryType.valueFromBytes(buf, off);
            entry._pos = entryPos;
            _.log(_.log.DBG, "entry:", entry, secIdx, entryIdx);
            if (entryType === S.longDirEntry) {
                var firstEntry;
                if (entry.Ord & S.lastLongFlag) {
                    firstEntry = true;
                    entry.Ord &= ~S.lastLongFlag;
                    long = {
                        name: -1,
                        sum: entry.Chksum,
                        _rem: entry.Ord-1,
                        _arr: []
                    }
                }
                if (firstEntry || long && entry.Chksum === long.sum && entry.Ord === long._rem--) {
                    var S_lde_f = S.longDirEntry.fields,
                        namepart = entry.Name1;
                    if (entry.Name1.length === S_lde_f.Name1.size/2) {
                        namepart += entry.Name2;
                        if (entry.Name2.length === S_lde_f.Name2.size/2) {
                            namepart += entry.Name3;
                        }
                    }
                    long._arr.push(namepart);
                    if (!long._rem) {
                        long.name = long._arr.reverse().join('');
                        delete long._arr;
                        delete long._rem;
                    }
                } else long = null;
            } else if ((attrByte & 0x08) === 0) {        // NOTE: checks `!entry.Attr.volume_id`
                var bestName = null;
                if (long && long.name) {
                    var pos = entryIdx + S.dirEntry.fields['Name'].offset,
                        sum = _.checksumName(buf, pos);
                    if (sum === long.sum) bestName = long.name;
                }
                if (!bestName) {
                    if (signalByte === S.entryIsE5Flag) entry.Name.filename = '\u00E5'+entry.Name.filename.slice(1);
                    
                    var nam = entry.Name.filename.replace(/ +$/, ''),
                        ext = entry.Name.extension.replace(/ +$/, '');
                    // TODO: lowercase bits http://en.wikipedia.org/wiki/8.3_filename#Compatibility
                    //       via NTRes, bits 0x08 and 0x10 http://www.fdos.org/kernel/fatplus.txt.1
                    bestName = (ext) ? nam+'.'+ext : nam;
                }
                entry._name = bestName;
                
                // OPTIMIZATION: avoid processing any fields for non-matching entries
                // TODO: we could make this automatic via getters, but…?
                var _entryBuffer = buf.slice(off.bytes-S.dirEntry.size, off.bytes);
                entry._full = function () {
                    var _entry = S.dirEntry.valueFromBytes(_entryBuffer);
                    _.extend(entry, _entry);
                    entry._size = entry.FileSize;
                    entry._firstCluster = (entry.FstClusHI << 16) + entry.FstClusLO;
                    return entry;
                };
                
                long = null;
                return cb(null, entry, entryPos);
            } else long = null;
            getNextEntry(cb);
        });
    }
    
    function iter(cb) {
        getNextEntry(cb);
        return iter;            // TODO: previous value can't be re-used, so why make caller re-assign?
    }
    return iter;
};

function _updateEntry(vol, entry, newStats) {
    if ('size' in newStats) entry._size = entry.FileSize = newStats.size;
    
    if ('_touch' in newStats) newStats.archive = newStats.atime = newStats.mtime = true;
    if ('archive' in newStats) entry.Attr.archive = true;           // TODO: also via newStats.mode?
    
    var _now;
    function applyDate(d, prefix, timeToo, tenthToo) {
        if (d === true) d = _now || (_now = new Date());
        entry[prefix+'Date'] = {year:d.getFullYear()-1980, month:d.getMonth()+1, day:d.getDate()};
        if (timeToo) {
            entry[prefix+'Time'] = {hours:d.getHours(), minutes:d.getMinutes(), seconds_2:d.getSeconds()>>>1};
            if (tenthToo) {
                var msec = (d.getSeconds() % 2)*1000 + d.getMilliseconds();
                entry[prefix+'TimeTenth'] = Math.floor(msec / 100);
            }
        }
    }
    if ('ctime' in newStats) applyDate(newStats.ctime, 'Crt', true, true);
    if ('mtime' in newStats) applyDate(newStats.mtime, 'Wrt', true);
    if ('atime' in newStats) applyDate(newStats.atime, 'LstAcc');
    
    if ('mode' in newStats) {
        entry.Attr.directory = (newStats.mode & S._I.FDIR) ? true : false;
        entry.Attr.volume_id = (newStats.mode & S._I.FREG) ? false : true;
        if (vol.opts.modmode === 0111) {
            entry.Attr.archive = (newStats.mode & S._I.XUSR) ? true : false;
            entry.Attr.system  = (newStats.mode & S._I.XGRP) ? true : false;
            entry.Attr.hidden  = (newStats.mode & S._I.XOTH) ? true : false;
            entry.Attr.readonly = (newStats.mode & S._I.WUSR) ? false : true;
        } else if (vol.opts.modmode === 07000) {
            entry.Attr.archive = (newStats.mode & S._I.SVTX) ? true : false;
            entry.Attr.system  = (newStats.mode & S._I.SGID) ? true : false;
            entry.Attr.hidden  = (newStats.mode & S._I.SUID) ? true : false;
            entry.Attr.readonly = (
                newStats.mode & S._I.WUSR ||
                newStats.mode & S._I.WGRP ||
                newStats.mode & S._I.WOTH
            ) ? false : true;
        }
    }
    
    if ('firstCluster' in newStats) {
        entry.FstClusLO = newStats.firstCluster & 0xFFFF;
        entry.FstClusHI = newStats.firstCluster >>> 16;
        entry._firstCluster = newStats.firstCluster;
    }
    return entry;
}

dir.makeStat = function (vol, entry) {
    var stats = {};     // TODO: return an actual `instanceof fs.Stat` somehow?
    
    stats.isFile = function () {
        return (!entry.Attr.volume_id && !entry.Attr.directory);
    };
    stats.isDirectory = function () {
        return entry.Attr.directory;
    };
    stats.isBlockDevice = function () { return false; }
    stats.isCharacterDevice = function () { return false; }
    stats.isSymbolicLink = function () { return false; }
    stats.isFIFO = function () { return false; }
    stats.isSocket = function () { return false; }
    stats.size = entry.FileSize;
    stats.blksize = vol._sectorsPerCluster*vol._sectorSize;
    stats.blocks = Math.ceil(stats.size / stats.blksize) || 1;
    stats.nlink = 1;
    
    stats.mode = S._I.RUSR | S._I.RGRP | S._I.ROTH;
    if (!entry.Attr.readonly) stats.mode |= S._I.WUSR | S._I.WGRP | S._I.WOTH;
    if (entry.Attr.directory) stats.mode |= S._I.FDIR;
    else if (!entry.Attr.volume_id) stats.mode |= S._I.FREG;
    // NOTE: discussion at https://github.com/natevw/fatfs/issues/7
    if (vol.opts.modmode === 0111) {
        // expose using executable bits, like Samba
        if (entry.Attr.archive) stats.mode |= S._I.XUSR;
        if (entry.Attr.system)  stats.mode |= S._I.XGRP;
        if (entry.Attr.hidden)  stats.mode |= S._I.XOTH;
    } else if (vol.opts.modmode === 07000) {
        // expose using setXid/sticky bits, like MKS
        if (entry.Attr.archive) stats.mode |= S._I.SVTX;
        if (entry.Attr.system)  stats.mode |= S._I.SGID;
        if (entry.Attr.hidden)  stats.mode |= S._I.SUID;
    }
    
    stats.mode &= ~vol.opts.umask;
    stats.uid =  vol.opts.uid;
    stats.gid = vol.opts.gid;
    
    function extractDate(prefix) {
        var date = entry[prefix+'Date'],
            time = entry[prefix+'Time'] || {hours:0, minutes:0, seconds_2:0},
            secs = time.seconds_2 * 2,
            sect = entry[prefix+'TimeTenth'] || 0;
        if (sect > 100) {
            secs += 1;
            sect -= 100;
        }
        return new Date(date.year+1980, date.month-1, date.day, time.hours, time.minutes, secs, sect*100);
    }
    stats.atime = extractDate('LstAcc');
    stats.mtime = extractDate('Wrt');
    stats.ctime = extractDate('Crt');
    
    entry = {           // keep immutable copy (with only the fields we need)
        Attr: _.extend({},entry.Attr),
    };
    
    return stats;
};

dir.init = function (vol, dirInfo, cb) {
    var dirChain = dirInfo.chain,
        isRootDir = ('numSectors' in dirChain),    // HACK: all others would be a clusterChain
        initialCluster = _.allocBuffer(dirChain.sectorSize*vol._sectorsPerCluster),
        entriesOffset = {bytes:0};
    initialCluster.fill(0);
    function writeEntry(name, clusterNum) {
        while (name.length < 8) name += " ";
        S.dirEntry.bytesFromValue(_updateEntry(vol, {
            Name: {filename:name, extension:"   "},
            Attr: {directory:true}
        }, {firstCluster:clusterNum, _touch:true,ctime:true}), initialCluster, entriesOffset);
    }
    if (!isRootDir) {
        writeEntry(".", dirChain.firstCluster);
        writeEntry("..", dirInfo.parent.chain.firstCluster);
    };
    dirChain.writeToPosition(0, initialCluster, cb);
};

dir.addFile = function (vol, dirChain, entryInfo, opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = {};
    }
    var name = entryInfo.name,
        entries = [], mainEntry;
    entries.push(mainEntry = {
        Name: _.shortname(name),
        Attr: {directory:opts.dir||false},
        _name: name
    });
    if (1 || mainEntry.Name._lossy) {         // HACK: always write long names until `._lossy` is more useful!
        var workaroundTessel427 = ('\uFFFF'.length !== 1);
        if (workaroundTessel427) throw Error("Your JS runtime does not have proper Unicode string support. (If Tessel, is your firmware up-to-date?)");
        
        // name entries should be 0x0000-terminated and 0xFFFF-filled
        var S_lde_f = S.longDirEntry.fields,
            ENTRY_CHUNK_LEN = (S_lde_f.Name1.size + S_lde_f.Name2.size + S_lde_f.Name3.size)/2,
            partialLen = name.length % ENTRY_CHUNK_LEN,
            paddingNeeded = partialLen && (ENTRY_CHUNK_LEN - partialLen);
        if (paddingNeeded--) name += '\u0000';
        while (paddingNeeded-- > 0) name += '\uFFFF';
        // now fill in as many entries as it takes
        var off = 0,
            ord = 1;
        while (off < name.length) entries.push({
            Ord: ord++,
            Name1: name.slice(off, off+=S_lde_f.Name1.size/2),
            Attr_raw: S.longDirFlag,
            Chksum: null,
            Name2: name.slice(off, off+=S_lde_f.Name2.size/2),
            Name3: name.slice(off, off+=S_lde_f.Name3.size/2)
        });
        entries[entries.length - 1].Ord |= S.lastLongFlag;
    }
    
    if (entryInfo.tail) {
        var name = mainEntry.Name.filename,
            suffix = '~'+entryInfo.tail,
            endIdx = name.indexOf(' '),
            sufIdx = (~endIdx) ? Math.min(endIdx, name.length-suffix.length) : name.length-suffix.length;
        if (sufIdx < 0) return cb(S.err.NAMETOOLONG());         // TODO: would EXIST be more correct?
        mainEntry.Name.filename = name.slice(0,sufIdx)+suffix+name.slice(sufIdx+suffix.length);
        _.log(_.log.DBG, "Shortname amended to:", mainEntry.Name);
    }
    
    vol.allocateInFAT(dirChain.firstCluster || 2, function (e,fileCluster) {
        if (e) return cb(e);
        
        var nameBuf = S.dirEntry.fields['Name'].bytesFromValue(mainEntry.Name),
            nameSum = _.checksumName(nameBuf);
        // TODO: finalize initial properties… (via `opts.mode` instead?)
        _updateEntry(vol, mainEntry, {firstCluster:fileCluster, size:0, ctime:true,_touch:true});
        mainEntry._pos = _.adjustedPos(vol, entryInfo.target, S.dirEntry.size*(entries.length-1));
        entries.slice(1).forEach(function (entry) {
            entry.Chksum = nameSum;
        });
        entries.reverse();
        if (entryInfo.lastEntry) entries.push({});
        
        var entriesData = _.allocBuffer(S.dirEntry.size*entries.length),
            dataOffset = {bytes:0};
        entries.forEach(function (entry) {
            var entryType = ('Ord' in entry) ? S.longDirEntry : S.dirEntry;
            entryType.bytesFromValue(entry, entriesData, dataOffset);
        });
        
        _.log(_.log.DBG, "Writing", entriesData.length, "byte directory entry", mainEntry, "into", dirChain.toJSON(), "at", entryInfo.target);
        dirChain.writeToPosition(entryInfo.target, entriesData, function (e) {
            // TODO: if we get error, what/should we clean up?
            if (e) cb(e);
            else cb(null, mainEntry, vol.chainForCluster(fileCluster, dirChain));
        });
    });
};

dir.findInDirectory = function (vol, dirChain, name, opts, cb) {
    var matchName = name.toUpperCase(),
        tailName = (opts.prepareForCreate) ? _.shortname(name) : null,
        maxTail = 0;
    
    function processNext(next) {
        next = next(function (e, d, entryPos) {
            if (e) cb(e);
            else if (!d) cb(S.err.NOENT(), {tail:maxTail, target:entryPos, lastEntry:true});
            else if (d._free) processNext(next);         // TODO: look for long enough reusable run
            else if (d._name.toUpperCase() === matchName) return cb(null, d._full());
            else if (!opts.prepareForCreate) processNext(next);
            else {
                var dNum = 1,
                    dName = d.Name.filename,
                    dTail = dName.match(/(.*)~(\d+)/);
                if (dTail) {
                    dNum = +dTail[2];
                    dName = dTail[1];
                }
                if (tailName.extension === d.Name.extension &&
                    tailName.filename.indexOf(dName) === 0)
                {
                    maxTail = Math.max(dNum+1, maxTail);
                }
                processNext(next);
            }
        });
    }
    processNext(dir.iterator(dirChain, {includeFree:(0 && opts.prepareForCreate)}));
};

dir.updateEntry = function (vol, entry, newStats, cb) {
    if (!entry._pos || !entry._pos.chain) throw Error("Entry source unknown!");
    
    var entryPos = entry._pos,
        newEntry = _updateEntry(vol, entry, newStats),
        data = S.dirEntry.bytesFromValue(newEntry);
    _.log(_.log.DBG, "UPDATING ENTRY", newStats, newEntry, entryPos, data);
    // TODO: if write fails, then entry becomes corrupt!
    entryPos.chain.writeToPosition(entryPos, data, cb);
};

},{"./helpers.js":4,"./structs.js":38}],4:[function(require,module,exports){
(function (Buffer,setImmediate){
var S = require("./structs.js"),
    _xok = require('xok');

// ponyfills for older node.js
exports.allocBuffer = Buffer.alloc || function (len, val) {
    var b = Buffer(len);
    if (arguments.length > 1) b.fill(val);
    return b;
};
exports.bufferFrom = Buffer.from || function (arg0, arg1) {
    return (arguments.length > 1) ? Buffer(arg0, arg1) : Buffer(arg0);
};

// flag for WORKAROUND: https://github.com/tessel/beta/issues/380
exports.workaroundTessel380 = !Buffer.from && function () {
    var b = Buffer([0]),
        s = b.slice(0);
    return ((s[0] = 0xFF) !== b[0]);
}();


// WORKAROUND: https://github.com/tessel/beta/issues/433
var oldslice;
if (!Buffer.alloc && Buffer(5).slice(10).length < 0) oldslice = Buffer.prototype.slice, Buffer.prototype.slice = function (s, e) {
    if (s > this.length) s = this.length;
    // ~WORKAROUND: https://github.com/tessel/beta/issues/434
    return (arguments.length > 1) ? oldslice.call(this, s, e) : oldslice.call(this, s);
}

exports.absoluteSteps = function (path) {
    var steps = [];
    path.split('/').forEach(function (str) {
        // NOTE: these should actually be fine, just wasteful…
        if (str === '..') steps.pop();
        else if (str && str !== '.') steps.push(str);
    });
    return steps.map(exports.longname);
};

exports.absolutePath = function (path) {
    return '/'+exports.absoluteSteps(path).join('/');
};

exports.parseFlags = function (flags) {
    // read, write, append, create, truncate, exclusive
    var info, _dir;           // NOTE: there might be more clever ways to "parse", but…
    if (flags[0] === '\\') {
        // internal flag used internally to `fs.open` directories without `S.err.ISDIR()`
        flags = flags.slice(1);
        _dir = true;
    }
    switch (flags) {
        case 'r':   info = {read:true, write:false, create:false}; break;
        case 'r+':  info = {read:true, write:true, create:false}; break;
        case 'rs':  info = {read:true, write:false, create:false, sync:true}; break;
        case 'rs+': info = {read:true, write:true, create:false, sync:true}; break;
        case 'w':   info = {read:false, write:true, create:true, truncate:true}; break;
        case 'wx':  info = {read:false, write:true, create:true, exclusive:true}; break;
        case 'w+':  info = {read:true, write:true, create:true, truncate:true}; break;
        case 'wx+': info = {read:true, write:true, create:true, exclusive:true}; break;
        case 'a':   info = {read:false, write:true, create:true, append:true}; break;
        case 'ax':  info = {read:false, write:true, create:true, append:true, exclusive:true}; break;
        case 'a+':  info = {read:true, write:true, create:true, append:true}; break;
        case 'ax+': info = {read:true, write:true, create:true, append:true, exclusive:true}; break;
        default: throw Error("Uknown mode: "+flags);       // TODO: throw as `S.err.INVAL`
    }
    if (info.sync) throw Error("Mode not implemented.");    // TODO: what would this require of us?
    if (_dir) info._openDir = true;
    return info;
};


// TODO: these are great candidates for special test coverage!
var _snInvalid = /[^A-Z0-9$%'-_@~`!(){}^#&.]/g;         // NOTE: '.' is not valid but we split it away
exports.shortname = function (name) {
    var lossy = false;
    // TODO: support preservation of case for otherwise non-lossy name!
    name = name.toUpperCase().replace(/ /g, '').replace(/^\.+/, '');
    name = name.replace(_snInvalid, function () {
        lossy = true;
        return '_';
    });
    
    var parts = name.split('.'),
        basis3 = parts.pop(),
        basis8 = parts.join('');
    if (!parts.length) {
        basis8 = basis3;
        basis3 = '   ';
    }
    if (basis8.length > 8) {
        basis8 = basis8.slice(0,8);
        // NOTE: technically, spec's "lossy conversion" flag is NOT set by excess length.
        //       But since lossy conversion and truncated names both need a numeric tail…
        lossy = true;
    } else while (basis8.length < 8) basis8 += ' ';
    if (basis3.length > 3) {
        basis3 = basis3.slice(0,3);
        lossy = true;
    } else while (basis3.length < 3) basis3 += ' ';
    
    return {filename:basis8, extension:basis3, _lossy:lossy};
    return {basis:[basis8,basis3], lossy:lossy};
};
//shortname("autoexec.bat") => {basis:['AUTOEXEC','BAT'],lossy:false}
//shortname("autoexecutable.batch") => {basis:['AUTOEXEC','BAT'],lossy:true}
// TODO: OS X stores `shortname("._.Trashes")` as ['~1', 'TRA'] — should we?

var _lnInvalid = /[^a-zA-Z0-9$%'-_@~`!(){}^#&.+,;=[\] ]/g;
exports.longname = function (name) {
    name = name.trim().replace(/\.+$/, '').replace(_lnInvalid, function (c) {
        if (c.length > 1) throw Error("Internal problem: unexpected match length!");
        if (c.charCodeAt(0) > 127) return c;
        else throw Error("Invalid character "+JSON.stringify(c)+" in name.");
        lossy = true;
        return '_';
    });
    if (name.length > 255) throw Error("Name is too long.");
    return name;
};

function nameChkSum(sum, c) {
    return ((sum & 1) ? 0x80 : 0) + (sum >>> 1) + c & 0xFF;
}

// WORKAROUND: https://github.com/tessel/beta/issues/335
function reduceBuffer(buf, start, end, fn, res) {
    // NOTE: does not handle missing `res` like Array.prototype.reduce would
    for (var i = start; i < end; ++i) {
        res = fn(res, buf[i]);
    }
    return res;
}

exports.checksumName = function (buf,off) {
    off || (off = 0);
    var len = S.dirEntry.fields['Name'].size;
    return reduceBuffer(buf, off, off+len, nameChkSum, 0);
};


/* comparing C rounding trick from FAT spec with Math.ceil
function tryBoth(d) {
    var a = ((D.RootEntCnt * 32) + (D.BytsPerSec - 1)) / D.BytsPerSec >>> 0,
        b = Math.ceil((D.RootEntCnt * 32) / D.BytsPerSec);
    if (b !== a) console.log("try", b, a, (b === a) ? '' : '*');
    return (b === a);
}
// BytsPerSec — "may take on only the following values: 512, 1024, 2048 or 4096"
[512, 1024, 2048, 4096].forEach(function (bps) {
    // RootEntCnt — "a count that when multiplied by 32 results in an even multiple of BPB_BytsPerSec"
    for (var evenMultiplier = 0; evenMultiplier < 1024*1024*16; evenMultiplier += 2) {
        var rec = (bps * evenMultiplier) / 32;
        tryBoth({RootEntCnt:rec, BytsPerSec:bps});
    }
});
*/

exports.fmtHex = function (n, ff) {
    return (1+ff+n).toString(16).slice(1);
};

exports.delayedCall = function (fn) {
    if (!fn) throw Error("No function provided!");      // debug aid
    var ctx = this,
        args = Array.prototype.slice.call(arguments, 1);
    setImmediate(function () {
        fn.apply(ctx, args);
    });
};

exports.adjustedPos = function (vol, pos, bytes) {
    var _pos = {
        chain: pos.chain,
        sector: pos.sector,
        offset: pos.offset + bytes
    }, secSize = vol._sectorSize;
    while (_pos.offset >= secSize) {
        _pos.sector += 1;
        _pos.offset -= secSize;
    }
    return _pos;
};

exports.extend = _xok;

var _prevDbg = Date.now(),
    _thresh = 50;

function log(level) {
    if (level < log.level) return;
    
    var now = Date.now(),
        diff = now - _prevDbg;
    arguments[0] = ((diff < _thresh) ? " " : '') + diff.toFixed(0)  + "ms";
    console.log.apply(console, arguments);
    _prevDbg = now;
}
log.DBG = -4;
log.INFO = -3;
log.WARN = -2;
log.ERR = -1;

log.level = log.WARN;

exports.log = log;

}).call(this,require("buffer").Buffer,require("timers").setImmediate)
},{"./structs.js":38,"buffer":8,"timers":35,"xok":37}],5:[function(require,module,exports){
(function (process){
var events = require('events'),
    streams = require('stream'),
    fifolock = require('fifolock'),
    S = require("./structs.js"),
    _ = require("./helpers.js");

//_.log.level = _.log.DBG;

exports.createFileSystem = function (volume, opts, cb) {
    if (typeof opts === 'function') {
        cb = opts;
        opts = null;
    }
    opts = _.extend({
        // c.f. https://www.kernel.org/doc/Documentation/filesystems/vfat.txt
        ro: false,
        noatime: true,
        modmode: 0111,       // or `07000`
        umask: ('umask' in process) ? process.umask() : 0022,
        uid: ('getuid' in process) ? process.getuid() : 0,
        gid: ('getgid' in process) ? process.getgid() : 0
    }, opts);
    if (!volume.writeSectors) opts.ro = true;
    if (opts.ro) opts.noatime = true;       // natch
    
    var fs = new events.EventEmitter(),
        vol = null,
        dir = require("./dir.js"),
        c = require("./chains.js"),
        q = fifolock();
    
    var GROUP = (_.log.level < _.log.INFO) ? q.TRANSACTION_WRAPPER.bind({
        postAcquire: function (proceed) {
            _.log(_.log.DBG, "=== Starting GROUP ===");
            proceed();
        },
        preRelease: function (finish) {
            _.log(_.log.DBG, "=== Finishing GROUP ===");
            finish();
        }
    }) : q.TRANSACTION_WRAPPER;
    
    q.acquire(function (unlock) {         // because of this, callers can start before 'ready'
        var d = _.allocBuffer(volume.sectorSize);
        volume.readSectors(0, d, function (e) {
            if (e) fs.emit('error', e);
            else {
                try {
                    init(d);
                } catch (e) {
                    fs.emit('error', e);
                    unlock();
                    return;
                }
                fs.emit('ready');
            }
            unlock();
        });
    });
    
    if (cb) fs.on('error', cb).on('ready', cb.bind(null, null));
    
    function init(bootSector) {
        vol = require("./vol.js").init(volume, opts, bootSector);
        fs._dirIterator = dir.iterator.bind(dir);
        
        var entryInfoByPath = {},
            baseEntry = {
                _refs: 0,
                _record: function () {
                    entryInfoByPath[this.path] = this;
                    if (this.parent) this.parent.retain();
                    return this;
                },
                retain: function () {
                    if (!this._refs) this._record();
                    this._refs += 1;
                    return this;
                },
                release: function () {
                    this._refs -= 1;
                    if (!this._refs) this._rescind();
                },
                _rescind: function () {
                    if (this.parent) this.parent.release();
                    delete entryInfoByPath[this.path];
                }
            };
        fs._createSharedEntry = function (path, entry, chain, parent) {
            return _.extend(Object.create(baseEntry), {
                _refs: 0,           // WORKAROUND: https://github.com/tessel/beta/issues/455
                path: path,
                entry: entry,
                chain: chain,
                parent: parent
            }).retain();
        };
        fs._createSharedEntry("/", {Attr:{directory:true}}, vol.rootDirectoryChain);
        fs._sharedEntryForSteps = function (steps, opts, cb) {         // NOTE: may `cb` before returning!
            var path = steps.join('/') || "/",
                name = steps.pop(), // n.b.
                info = entryInfoByPath[path];
            if (info) cb(null, info.retain());
            else fs._sharedEntryForSteps(steps, {}, function (e,parentInfo) {  // n.b. `steps` don't include `name`
                if (e) cb(e);
                else if (!parentInfo.entry.Attr.directory) cb(S.err.NOTDIR())
                else dir.findInDirectory(vol, parentInfo.chain, name, opts, function (e,entry) {
                    if (e && !opts.prepareForCreate) cb(e);
                    else if (e) cb(e, {missingChild:_.extend(entry, {name:name}), parent:parentInfo});
                    else cb(null, fs._createSharedEntry(path, entry, vol.chainForCluster(entry._firstCluster), parentInfo));
                });
            });
        }
        
        fs._updateEntry = dir.updateEntry.bind(dir, vol);
        fs._makeStat = dir.makeStat.bind(dir, vol);
        fs._addFile = dir.addFile.bind(dir, vol);
        fs._initDir = dir.init.bind(dir, vol);
    }
    
    
    
    /**** ---- CORE API ---- ****/
    
    // NOTE: we really don't share namespace, but avoid first three anyway…
    var fileDescriptors = [null,null,null];
    
    fs.open = function (path, flags, mode, cb, _n_) { 
        if (typeof mode === 'function') {
            _n_ = cb;
            cb = mode;
            mode = 0666;
        }
    cb = GROUP(cb, function () {
        var _fd = {flags:null,entry:null,chain:null,pos:0},
            f = _.parseFlags(flags);
        if (vol.opts.ro && (f.write || f.create || f.truncate)) return _.delayedCall(cb, S.err.ROFS());
        else _fd.flags = f;
        
        fs._sharedEntryForSteps(_.absoluteSteps(path), {prepareForCreate:f.create}, function (e,info) {
            if (e && !(e.code === 'NOENT' && f.create && info)) cb(e);
            else if (e) fs._addFile(info.parent.chain, info.missingChild, {dir:f._openDir}, function (e,newEntry,newChain) {
                if (e) cb(e);
                else finish(fs._createSharedEntry(_.absolutePath(path), newEntry, newChain, info.parent));
            });
            else if (info && f.exclusive) cb(S.err.EXIST());
            else if (info.entry.Attr.directory && !f._openDir) cb(S.err.ISDIR());
            else if (f.write && info.entry.Attr.readonly) cb(S.err.ACCES());
            else finish(info);
            function finish(fileInfo) {
                var fd = fileDescriptors.push(_fd)-1;
                _fd.info = fileInfo;
                _fd.entry = fileInfo.entry;
                _fd.chain = fileInfo.chain;
                if (f.append) _fd.pos = _fd.entry._size;
                if (f._openDir) _fd.chain.cacheAdvice = 'WILLNEED';
                if (f.truncate && _fd.entry._size) fs.ftruncate(fd, 0, function (e) {
                    cb(e, fd);
                }, '_nested_');
                else _.delayedCall(cb, null, fd);       // (delay in case fs._sharedEntryForSteps all cached!)
            }
        });
    }, (_n_ === '_nested_')); };
    
    fs.fstat = function (fd, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.read) _.delayedCall(cb, S.err.BADF());
        else _.delayedCall(cb, null, fs._makeStat(_fd.entry));
    }, (_n_ === '_nested_')); };
    
    fs.futimes = function (fd, atime, mtime, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        // NOTE: ctime would get touched on POSIX; but we map that to create time!
        else fs._updateEntry(_fd.entry, {atime:atime||true,mtime:mtime||true}, cb);
    }, (_n_ === '_nested_')); };
    
    fs.fchmod = function (fd, mode, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        else {
            mode &= S._I._chmoddable;
            if (_fd.entry.Attr.directory) mode |= S._I.FDIR;
            else if (!_fd.entry.Attr.volume_id) mode |= S._I.FREG;
            fs._updateEntry(_fd.entry, {mode:mode}, cb);
        }
    }, (_n_ === '_nested_')); };
    
    fs.read = function (fd, buf, off, len, pos, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.read) _.delayedCall(cb, S.err.BADF());
        
        var _pos = (pos === null) ? _fd.pos : pos,
            _len = Math.min(len, _fd.entry._size - _pos),
            _buf = buf.slice(off,off+_len);
        _fd.chain.readFromPosition(_pos, _buf, function (e,bytes,slice) {
            if (_.workaroundTessel380) _buf.copy(buf,off);        // WORKAROUND: https://github.com/tessel/beta/issues/380
            _fd.pos = _pos + bytes;
            if (e || vol.opts.noatime) finish(e);
            else fs._updateEntry(_fd.entry, {atime:true}, finish);
            function finish(e) {
                cb(e,bytes,buf);
            }
        });
    }, (_n_ === '_nested_')); };
    
    fs._readdir = function (fd, cb, _n_)  { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.read) _.delayedCall(cb, S.err.BADF());
        else {
            var entryNames = [],
                getNextEntry = fs._dirIterator(_fd.chain);
            function processNext() {
                getNextEntry(function (e,d) {
                    if (e) cb(e);
                    else if (!d && !entryNames.length) cb(null, entryNames); // WORKAROUND: https://github.com/tessel/beta/issues/435
                    else if (!d) cb(null, entryNames.sort());       // NOTE: sort not required, but… [simplifies tests for starters!]
                    else {
                        if (d._name !== "." && d._name !== "..") entryNames.push(d._name);
                        processNext();
                    }
                });
            }
            processNext();
        }
    }, (_n_ === '_nested_')); };
    
    fs._mkdir = function (fd, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        else fs._initDir(_fd.info, cb);
    }, (_n_ === '_nested_')); };
    
    fs.write = function (fd, buf, off, len, pos, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        
        var _pos = (pos === null || _fd.flags.append) ? _fd.pos : pos,
            _buf = buf.slice(off,off+len);
        if (_pos > _fd.entry._size) {
            // TODO: handle huge jumps by zeroing clusters individually?
            var padLen = _pos - _fd.entry._size,
                padBuf = _.allocBuffer(padLen + _buf.length);
            padBuf.fill(0x00, 0, padLen);
            _buf.copy(padBuf, padLen);
            _pos = _fd.entry._size;
            _buf = padBuf;
        }
        _fd.chain.writeToPosition(_pos, _buf, function (e) {
            _fd.pos = _pos + len;
            var newSize = Math.max(_fd.entry._size, _fd.pos),
                newInfo = {size:newSize,_touch:true};
            fs._updateEntry(_fd.entry, newInfo, function (ee) {
                cb(e||ee, len, buf);
            });
        });
    }, (_n_ === '_nested_')); };
    
    fs.ftruncate = function (fd, len, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        
        var newStats = {size:len,_touch:true};
        // NOTE: we order operations for best state in case of only partial success
        if (len === _fd.entry._size) _.delayedCall(cb);
        else if (len < _fd.entry._size) fs._updateEntry(_fd.entry, newStats, function (e) {
            if (e) cb(e);
            else _fd.chain.truncate(Math.ceil(len / _fd.chain.sectorSize), cb);
        });     // TODO: handle huge file expansions without as much memory pressure
        else _fd.chain.writeToPosition(_fd.entry._size, _.allocBuffer(len-_fd.entry._size, 0x00), function (e) {
            if (e) cb(e);
            else fs._updateEntry(_fd.entry, newStats, cb);
        });
    }, (_n_ === '_nested_')); };
    
    // 'NORMAL', 'SEQUENTIAL', 'RANDOM', 'WILLNEED', 'DONTNEED', 'NOREUSE'
    fs._fadviseSync = function (fd, off, len, advice) {
        if (off !== 0 || len !== 0) throw Error("Cache advise can currently be given only for whole file!");
        var _fd = fileDescriptors[fd];
        if (!_fd) throw S.err.BADF();
        else _fd.chain.cacheAdvice = advice;
    };
    
    fs.fsync = function (fd, cb) {
        // NOTE: we'll need to flush write cache here once we have one…
        var _fd = fileDescriptors[fd];
        if (!_fd) _.delayedCall(cb, S.err.BADF());
        else _.delayedCall(cb);
    };
    
    fs.close = function (fd, cb) {
        var _fd = fileDescriptors[fd];
        if (!_fd) _.delayedCall(cb, S.err.BADF());
        else setTimeout(_fd.info.release.bind(_fd.info), 500), _.delayedCall(cb, fileDescriptors[fd] = null);
    };
    
    
    /* STREAM WRAPPERS */
    
    var workaroundTessel436;
    try {
        new require('stream').Readable({encoding:'utf8'});
        new streams.Readable({encoding:'utf8'});
    } catch (e) {
        workaroundTessel436 = true;
    }
    
    function _createStream(StreamType, path, opts) {
        // [NOT REALLY A] WORKAROUND: https://github.com/tessel/beta/issues/436
        if (workaroundTessel436 && 'encoding' in opts) {
            console.warn("Tessel does not currently support encoding option for Readable streams, discarding!");
            delete opts.encoding;
        }
        
        var fd = (opts.fd !== null) ? opts.fd : '_opening_',
            pos = opts.start,
            stream = new StreamType(opts);
        
        if (fd === '_opening_') fs.open(path, opts.flags, opts.mode, function (e,_fd) {
            if (e) {
                fd = '_open_error_';
                stream.emit('error', e);
            } else {
                fd = _fd;
                fs._fadviseSync(fd, 0, 0, 'SEQUENTIAL');
                stream.emit('open', fd);
            }
        });
        
        function autoClose(tombstone) {      // NOTE: assumes caller will clear `fd`
            if (opts.autoClose) fs.close(fd, function (e) {
                if (e) stream.emit('error', e);
                else stream.emit('close');
            });
            fd = tombstone;
        }
        
        if (StreamType === streams.Readable) {
            
            stream._read = function (n) {
                var buf;
                // TODO: optimize to fetch at least a full sector regardless of `n`…
                n = Math.min(n, opts.end-pos);
                if (fd === '_opening_') stream.once('open', function () { stream._read(n); });
                else if (pos > opts.end) stream.push(null);
                else if (n > 0) buf = _.allocBuffer(n), fs.read(fd, buf, 0, n, pos, function (e,n,d) {
                    if (e) {
                        autoClose('_read_error_');
                        stream.emit('error', e);
                    } else stream.push((n) ? d.slice(0,n) : null);
                }), pos += n;
                else stream.push(null);
            };
            
            stream.once('end', function () {
                autoClose('_ended_');
            });
            
        } else if (StreamType === streams.Writable) {
            
            stream.bytesWritten = 0;
            
            stream._write = function (data, _enc, cb) {
                if (fd === '_opening_') stream.once('open', function () { stream._write(data, null, cb); });
                else fs.write(fd, data, 0, data.length, pos, function (e,n) {
                    if (e) {
                        autoClose('_write_error_');
                        cb(e);
                    } else {
                        stream.bytesWritten += n;
                        cb();
                    }
                }), pos += data.length;
            };
            
            stream.once('finish', function () {
                autoClose('_finished_');
            });
            
        }
        
        return stream;
    }
    
    fs.createReadStream = function (path, opts) {
        return _createStream(streams.Readable, path, _.extend({
            start: 0,
            end: Infinity,
            flags: 'r',
            mode: 0666,
            encoding: null,
            fd: null,           // ??? see https://github.com/joyent/node/issues/7708
            autoClose: true
        }, opts));
    };
    
    fs.createWriteStream = function (path, opts) {
        return _createStream(streams.Writable, path, _.extend({
            start: 0,
            flags: 'w',
            mode: 0666,
            //encoding: null,   // see https://github.com/joyent/node/issues/7710
            fd: null,           // ??? see https://github.com/joyent/node/issues/7708
            autoClose: true
        }, opts, {decodeStrings:true, objectMode:false}));
    };
    
    
    /* PATH WRAPPERS (albeit the only public interface for some folder operations) */
    
    function _fdOperation(path, opts, fn, cb) { cb = GROUP(cb, function () {
        opts.advice || (opts.advice = 'NORMAL');
        fs.open(path, opts.flag, function (e,fd) {
            if (e) cb(e);
            else fs._fadviseSync(fd, 0, 0, opts.advice), fn(fd, function () {
                var ctx = this, args = arguments;
                fs.close(fd, function (closeErr) {
                    cb.apply(ctx, args);
                }, '_nested_');
            });
        }, '_nested_');
    }); }
    
    fs.stat = fs.lstat = function (path, cb) {
        _fdOperation(path, {flag:'r'}, function (fd, cb) {
            fs.fstat(fd, cb, '_nested_');
        }, cb);
    };
    
    fs.exists = function(path, cb){
      fs.stat(path, function(err){
         cb(err ? false : true);
      });  
    };
    
    fs.readFile = function (path, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        opts.flag || (opts.flag = 'r');
        opts.advice || (opts.advice = 'NOREUSE');
        _fdOperation(path, opts, function (fd, cb) {
            fs.fstat(fd, function (e,stat) {
                if (e) return cb(e);
                else {
                    var buffer = _.allocBuffer(stat.size);
                    fs.read(fd, buffer, 0, buffer.length, null, function (e) {
                        if (e) cb(e);
                        else cb(null, (opts.encoding) ? buffer.toString(opts.encoding) : buffer);
                    }, '_nested_');
                }
            }, '_nested_');
        }, cb);
    };
    
    fs.writeFile = function (path, data, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        opts.flag || (opts.flag = 'w');
        opts.advice || (opts.advice = 'NOREUSE');
        _fdOperation(path, opts, function (fd, cb) {
            if (typeof data === 'string') data = _.bufferFrom(data, opts.encoding || 'utf8');
            fs.write(fd, data, 0, data.length, null, function (e) { cb(e); }, '_nested_');
        }, cb);
    };
    
    fs.appendFile = function (path, data, opts, cb) {
        if (typeof opts === 'function') {
            cb = opts;
            opts = {};
        }
        opts.flag || (opts.flag = 'a');
        fs.writeFile(path, data, opts, cb);
    };
    
    fs.truncate = function (path, len, cb) {
        _fdOperation(path, {flag:'r+'}, function (fd, cb) {
            fs.ftruncate(fd, len, cb, '_nested_');
        }, cb);
    };
    
    fs.readdir = function (path, cb) {
        _fdOperation(path, {flag:'\\r'}, function (fd, cb) {
            fs._readdir(fd, cb, '_nested_');
        }, cb);
    };
    
    fs.mkdir = function (path, mode, cb) {
        if (typeof mode === 'function') {
            cb = mode;
            mode = 0777;
        }
        _fdOperation(path, {flag:'\\wx'}, function (fd, cb) {
            fs._mkdir(fd, cb, '_nested_');
        }, cb);
    };
    
    fs.utimes = function (path, atime, mtime, cb) {
        _fdOperation(path, {flag:'r+'}, function (fd, cb) {
            fs.futimes(fd, atime, mtime, cb, '_nested_');
        }, cb);
    };
    
    fs.chmod = fs.lchmod = function (path, mode, cb) {
        _fdOperation(path, {flag:'\\r+'}, function (fd, cb) {
            fs.fchmod(fd, mode, cb, '_nested_');
        }, cb);
    };
    
    fs.chown = fs.lchown = function (path, uid, gid, cb) {
        _fdOperation(path, {flag:'\\r+'}, function (fd, cb) {
            fs.fchown(fd, uid, gid, cb, '_nested_');
        }, cb);
    };
    
    
    /* STUBS */
    
    fs.link = function (src, dst, cb) {
        // NOTE: theoretically we _could_ do hard links [with untracked `stat.nlink` count…]
        _.delayedCall(cb, S.err.NOSYS());
    };
    
    fs.symlink = function (src, dst, type, cb) {
        if (typeof type === 'function') {
            cb = type;
            type = null;
        }
        _.delayedCall(cb, S.err.NOSYS());
    };
    
    fs.readlink = function (path, cb) {
        _fdOperation(path, {flag:'\\r'}, function (fd, cb) {
            // the named file is *never* a symbolic link…
            // NOTE: we still use _fdOperation for catching e.g. NOENT/NOTDIR errors…
            cb(S.err.INVAL());
        }, cb);
    };
    
    fs.realpath = function (path, cache, cb) {
        if (typeof cache === 'function') {
            cb = cache;
            cache = null;
        }
        if (cache) _.delayedCall(cb, S.err.NOSYS());        // TODO: what would be involved here?
        else _fdOperation(path, {flag:'\\r'}, function (fd, cb) {
            cb(null, _.absolutePath(path));
        }, cb);
    };
    
    fs.fchown = function (fd, uid, gid, cb, _n_) { cb = GROUP(cb, function () {
        var _fd = fileDescriptors[fd];
        if (!_fd || !_fd.flags.write) _.delayedCall(cb, S.err.BADF());
        else _.delayedCall(cb, S.err.NOSYS());
    }, (_n_ === '_nested_')); };
    
    
    return fs;
}

}).call(this,require('_process'))
},{"./chains.js":2,"./dir.js":3,"./helpers.js":4,"./structs.js":38,"./vol.js":39,"_process":17,"events":10,"fifolock":11,"stream":33}],6:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],7:[function(require,module,exports){

},{}],8:[function(require,module,exports){
(function (Buffer){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this,require("buffer").Buffer)
},{"base64-js":6,"buffer":8,"ieee754":12}],9:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":14}],10:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],11:[function(require,module,exports){
(function (process){
// very simple FIFO serial queue (plus callback wrapper), helps you call `fn`s in order

module.exports = function SerialQueue() {
    var q = {},
        tasks = [];
    function runNext() {
        tasks[0](function () {
            tasks.shift();         // TODO: avoid?
            if (tasks.length) runNext();
        });
    }
    
    // usage: `q.aquire(function (release) { … release(); });`
    q.acquire = function (fn) {
        var len = tasks.push(fn);
        if (len === 1) process.nextTick(runNext);
    };
    
    // usage: `cb = q.TRANSACTION_WRAPPER(cb, function () { … cb(); });`
    // (pass `true` for `nested` if your own caller already holds lock)
    q.TRANSACTION_WRAPPER = function (cb, proceed, nested) {
        if (nested) return process.nextTick(proceed), cb;
        var _releaseQueue;
        if ('postAcquire' in this) proceed = this.postAcquire.bind(q, proceed);
        q.acquire(function (releaseQueue) {
            _releaseQueue = releaseQueue;
            proceed();
        });
        var capturedCB, finish = ('preRelease' in this) ? this.preRelease.bind(q, _finish) : _finish;
        function _finish() {
            capturedCB();
            _releaseQueue();
        }
        return function () {
            capturedCB = Function.prototype.apply.bind(cb, this, arguments);
            finish.call(null, Array.prototype.slice.call(arguments, 0), this);
        };
    };
    
    return q;
};

}).call(this,require('_process'))
},{"_process":17}],12:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],13:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],14:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],15:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],16:[function(require,module,exports){
(function (process){
'use strict';

if (typeof process === 'undefined' ||
    !process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = { nextTick: nextTick };
} else {
  module.exports = process
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}


}).call(this,require('_process'))
},{"_process":17}],17:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],18:[function(require,module,exports){
module.exports = require('./lib/_stream_duplex.js');

},{"./lib/_stream_duplex.js":19}],19:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = Object.create(require('core-util-is'));
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

{
  // avoid scope creep, the keys array can then be collected
  var keys = objectKeys(Writable.prototype);
  for (var v = 0; v < keys.length; v++) {
    var method = keys[v];
    if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
  }
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

Object.defineProperty(Duplex.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  pna.nextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  pna.nextTick(cb, err);
};
},{"./_stream_readable":21,"./_stream_writable":23,"core-util-is":9,"inherits":13,"process-nextick-args":16}],20:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = Object.create(require('core-util-is'));
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":22,"core-util-is":9,"inherits":13}],21:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

/*<replacement>*/
var util = Object.create(require('core-util-is'));
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') return emitter.prependListener(event, fn);

  // This is a hack to make sure that our error handler is attached before any
  // userland ones.  NEVER DO THIS. This is here only because this code needs
  // to continue to work with older versions of Node.js that do not include
  // the prependListener() method. The goal is to eventually remove this hack.
  if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var readableHwm = options.readableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (readableHwm || readableHwm === 0)) this.highWaterMark = readableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) pna.nextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    pna.nextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) pna.nextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        pna.nextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    pna.nextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var _this = this;

  var state = this._readableState;
  var paused = false;

  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) _this.push(chunk);
    }

    _this.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = _this.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], this.emit.bind(this, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  this._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return this;
};

Object.defineProperty(Readable.prototype, 'readableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._readableState.highWaterMark;
  }
});

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    pna.nextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":19,"./internal/streams/BufferList":24,"./internal/streams/destroy":25,"./internal/streams/stream":26,"_process":17,"core-util-is":9,"events":10,"inherits":13,"isarray":15,"process-nextick-args":16,"safe-buffer":27,"string_decoder/":28,"util":7}],22:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = Object.create(require('core-util-is'));
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function afterTransform(er, data) {
  var ts = this._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return this.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data != null) // single equals check for both `null` and `undefined`
    this.push(data);

  cb(er);

  var rs = this._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    this._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = {
    afterTransform: afterTransform.bind(this),
    needTransform: false,
    transforming: false,
    writecb: null,
    writechunk: null,
    writeencoding: null
  };

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.on('prefinish', prefinish);
}

function prefinish() {
  var _this = this;

  if (typeof this._flush === 'function') {
    this._flush(function (er, data) {
      done(_this, er, data);
    });
  } else {
    done(this, null, null);
  }
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this2 = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this2.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data != null) // single equals check for both `null` and `undefined`
    stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  if (stream._writableState.length) throw new Error('Calling transform done when ws.length != 0');

  if (stream._transformState.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":19,"core-util-is":9,"inherits":13}],23:[function(require,module,exports){
(function (process,global,setImmediate){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : pna.nextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = Object.create(require('core-util-is'));
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}

/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // Duplex streams are both readable and writable, but share
  // the same options object.
  // However, some cases require setting options to different
  // values for the readable and the writable sides of the duplex stream.
  // These options can be provided separately as readableXXX and writableXXX.
  var isDuplex = stream instanceof Duplex;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (isDuplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var writableHwm = options.writableHighWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;

  if (hwm || hwm === 0) this.highWaterMark = hwm;else if (isDuplex && (writableHwm || writableHwm === 0)) this.highWaterMark = writableHwm;else this.highWaterMark = defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;
      if (this !== Writable) return false;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  pna.nextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    pna.nextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = !state.objectMode && _isUint8Array(chunk);

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

Object.defineProperty(Writable.prototype, 'writableHighWaterMark', {
  // making it explicit this property is not enumerable
  // because otherwise some prototype manipulation in
  // userland will fail
  enumerable: false,
  get: function () {
    return this._writableState.highWaterMark;
  }
});

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    pna.nextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    pna.nextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
    state.bufferedRequestCount = 0;
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      state.bufferedRequestCount--;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      pna.nextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) pna.nextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("timers").setImmediate)
},{"./_stream_duplex":19,"./internal/streams/destroy":25,"./internal/streams/stream":26,"_process":17,"core-util-is":9,"inherits":13,"process-nextick-args":16,"safe-buffer":27,"timers":35,"util-deprecate":36}],24:[function(require,module,exports){
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
var util = require('util');

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();

if (util && util.inspect && util.inspect.custom) {
  module.exports.prototype[util.inspect.custom] = function () {
    var obj = util.inspect({ length: this.length });
    return this.constructor.name + ' ' + obj;
  };
}
},{"safe-buffer":27,"util":7}],25:[function(require,module,exports){
'use strict';

/*<replacement>*/

var pna = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      pna.nextTick(emitErrorNT, this, err);
    }
    return this;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      pna.nextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });

  return this;
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":16}],26:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":10}],27:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":8}],28:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte. If an invalid byte is detected, -2 is returned.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return byte >> 6 === 0x02 ? -1 : -2;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i || nb === -2) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// a single UTF-8 replacement character ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd';
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd';
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd';
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character is added when ending on a partial
// character.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd';
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":27}],29:[function(require,module,exports){
module.exports = require('./readable').PassThrough

},{"./readable":30}],30:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":19,"./lib/_stream_passthrough.js":20,"./lib/_stream_readable.js":21,"./lib/_stream_transform.js":22,"./lib/_stream_writable.js":23}],31:[function(require,module,exports){
module.exports = require('./readable').Transform

},{"./readable":30}],32:[function(require,module,exports){
module.exports = require('./lib/_stream_writable.js');

},{"./lib/_stream_writable.js":23}],33:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":10,"inherits":13,"readable-stream/duplex.js":18,"readable-stream/passthrough.js":29,"readable-stream/readable.js":30,"readable-stream/transform.js":31,"readable-stream/writable.js":32}],34:[function(require,module,exports){
(function (Buffer){
var _ = {};

// These functions approximately reproduce the (pre-node 10) noAssert functionality,
// which allowed reading/writing past the end of a buffer, but 0-padding/ignoring
// any extra content.

function truncatedReadUInt32BE(buffer, offset) {
    var availableBytes = buffer.length - offset;

    if (availableBytes >= 4) {
        return buffer.readUInt32BE(offset);
    } else if (availableBytes === 3) {
        var first = buffer.readUInt16BE(offset);
        var second = buffer.readUInt8(offset + 2);
        return ((first << 8) + second) << 8 >>> 0;
    } else if (availableBytes === 2) {
        return buffer.readUInt16BE(offset) << 16 >>> 0;
    } else if (availableBytes === 1) {
        return buffer.readUInt8(offset) << 24 >>> 0;
    } else if (availableBytes <= 0) {
        return 0x0;
    }
}

function truncatedWriteUInt32BE(buffer, offset, data) {
    var availableBytes = buffer.length - offset;

    if (availableBytes >= 4) {
        buffer.writeUInt32BE(data, offset);
    } else if (availableBytes === 3) {
        buffer.writeUInt16BE(data >>> 16, offset);
        buffer.writeUInt8((data >>> 8) & 0xff, offset + 2);
    } else if (availableBytes === 2) {
        buffer.writeUInt16BE(data >>> 16, offset);
    } else if (availableBytes === 1) {
        buffer.writeUInt8(data >>> 24, offset);
    }
}

// new Buffer() is deprecated in recent node. This ensures
// we always use the correct method for the current node.
function newBuffer(size) {
    if (Buffer.alloc) {
        return Buffer.alloc(size);
    } else {
        return new Buffer(size);
    }
}

function extend(obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (ext) {
        Object.keys(ext).forEach(function (key) {
            obj[key] = ext[key];
        });
    });
    return obj;
}

function addField(ctr, f) {
    if ('width' in f) {
        ctr.bits = (ctr.bits || 0) + f.width;
        while (ctr.bits > 7) {
            ctr.bytes += 1;
            ctr.bits -= 8;
        }
    } else if (!ctr.bits) {
        ctr.bytes += f.size;
    } else {
        throw Error("Improperly aligned bitfield before field: "+f.name);
    }
    return ctr;
}

function arrayizeField(f, count) {
    var f2 = (typeof count === 'number') ? extend({
        name: f.name,
        field: f,
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var arr = new Array(count);
            for (var idx = 0, len = arr.length; idx < len; idx += 1) {
                arr[idx] = f.valueFromBytes(buf, off);
            }
            return arr;
        },
        bytesFromValue: function (arr, buf, off) {
            arr || (arr = new Array(count));
            buf || (buf = newBuffer(this.size));
            off || (off = {bytes:0, bits:0});
            for (var idx = 0, len = Math.min(arr.length, count); idx < len; idx += 1) {
                f.bytesFromValue(arr[idx], buf, off);
            }
            while (idx++ < count) addField(off, f);
            return buf;
        }
    }, ('width' in f) ? {width: f.width * count} : {size: f.size * count}) : f;
    f2.pack = f2.bytesFromValue;
    f2.unpack = f2.valueFromBytes;
    return f2;
}

_.struct = function (name, fields, count) {
    if (typeof name !== 'string') {
        count = fields;
        fields = name;
        name = null;
    }
    
    var _size = {bytes:0, bits:0},
        _padsById = Object.create(null),
        fieldsObj = fields.reduce(function (obj, f, i) {
            if ('_padTo' in f) {
                // HACK: we really should just make local copy of *all* fields
                f._id || (f._id = 'id'+Math.random().toFixed(20).slice(2));      // WORKAROUND: https://github.com/tessel/runtime/issues/716
                var _f = _padsById[f._id] = (_size.bits) ? {
                    width: 8*(f._padTo - _size.bytes) - _size.bits
                } : {
                    size: f._padTo - _size.bytes
                };
                if (_f.width < 0 || _f.size < 0) {
                    var xtraMsg = (_size.bits) ? (" and "+_size.bits+" bits") : '';
                    throw Error("Invalid .padTo("+f._padTo+") field, struct is already "+_size.bytes+" byte(s)"+xtraMsg+"!");
                }
                f = _f;
            }
            else if (f._hoistFields) Object.keys(f._hoistFields).forEach(function (name) {
                var _f = Object.create(f._hoistFields[name]);
                if ('width' in _f) _f.offset = {bytes:_f.offset.bytes+_size.bytes, bits:_f.offset.bits};
                else _f.offset += _size.bytes;
                obj[name] = _f;
            });
            else if (f.name) {
                f = Object.create(f);           // local overrides
                f.offset = ('width' in f) ? {bytes:_size.bytes,bits:_size.bits} : _size.bytes,
                obj[f.name] = f;
            }
            addField(_size, f);
            return obj;
        }, {});
    if (_size.bits) throw Error("Improperly aligned bitfield at end of struct: "+name);
    
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var obj = new Object();
            fields.forEach(function (f) {
                if ('_padTo' in f) return addField(off, _padsById[f._id]);
                
                var value = f.valueFromBytes(buf, off);
                if (f.name) obj[f.name] = value;
                else if (typeof value === 'object') extend(obj, value);
            });
            return obj;
        },
        bytesFromValue: function (obj, buf, off) {
            obj || (obj = {});
            buf || (buf = newBuffer(this.size));
            off || (off = {bytes:0, bits:0});
            fields.forEach(function (f) {
                if ('_padTo' in f) return addField(off, _padsById[f._id]);
                
                var value = (f.name) ? obj[f.name] : obj;
                f.bytesFromValue(value, buf, off);
            });
            return buf;
        },
        _hoistFields: (!name) ? fieldsObj : null,
        fields: fieldsObj,
        size: _size.bytes,
        name: name
    }, count);
};

_.padTo = function (off) {
    return {_padTo:off};
};


// NOTE: bitfields must be embedded in a struct (C/C++ share this limitation)

var FULL = 0xFFFFFFFF;
function bitfield(name, width, count) {
    width || (width = 1);
    // NOTE: width limitation is so all values will align *within* a 4-byte word
    if (width > 24) throw Error("Bitfields support a maximum width of 24 bits.");
    var impl = this,
        mask = FULL >>> (32 - width);
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var end = (off.bits || 0) + width,
                word = truncatedReadUInt32BE(buf, off.bytes) || 0,
                over = word >>> (32 - end);
            addField(off, this);
            return impl.b2v.call(this, over & mask);
        },
        bytesFromValue: function (val, buf, off) {
            val = impl.v2b.call(this, val || 0);
            off || (off = {bytes:0, bits:0});
            var end = (off.bits || 0) + width,
                word = truncatedReadUInt32BE(buf, off.bytes) || 0,
                zero = mask << (32 - end),
                over = (val & mask) << (32 - end);
            word &= ~zero;
            word |= over;
            word >>>= 0;      // WORKAROUND: https://github.com/tessel/runtime/issues/644
            truncatedWriteUInt32BE(buf, off.bytes, word);
            addField(off, this);
            return buf;
        },
        width: width,
        name: name
    }, count);
}

function swapBits(n, w) {
    var o = 0;
    while (w--) {
        o <<= 1;
        o |= n & 1;
        n >>>= 1;
    }
    return o;
}


_.bool = function (name, count) {
    return bitfield.call({
        b2v: function (b) { return Boolean(b); },
        v2b: function (v) { return (v) ? FULL : 0; }
    }, name, 1, count);

};
_.ubit = bitfield.bind({
    b2v: function (b) { return b; },
    v2b: function (v) { return v; }
});
_.ubitLE = bitfield.bind({
    b2v: function (b) { return swapBits(b, this.width); },
    v2b: function (v) { return swapBits(v, this.width); }
});
_.sbit = bitfield.bind({        // TODO: handle sign bit…
    b2v: function (b) {
        var m = 1 << (this.width-1),
            s = b & m;
        return (s) ? -(b &= ~m) : b;
    },
    v2b: function (v) {
        var m = 1 << (this.width-1),
            s = (v < 0);
        return (s) ? (-v | m) : v;
    }
});


function bytefield(name, size, count) {
    if (typeof name !== 'string') {
        count = size;
        size = name;
        name = null;
    }
    size = (typeof size === 'number') ? size : 1;
    var impl = this;
    return arrayizeField({
        valueFromBytes: function (buf, off) {
            off || (off = {bytes:0, bits:0});
            var val = buf.slice(off.bytes, off.bytes+this.size);
            addField(off, this);
            return impl.b2v.call(this, val);
        },
        bytesFromValue: function (val, buf, off) {
            off || (off = {bytes:0});
            buf || (buf = newBuffer(this.size));
            var blk = buf.slice(off.bytes, off.bytes+this.size),
                len = impl.vTb.call(this, val, blk);
            if (len < blk.length) blk.fill(0, len);
            addField(off, this);
            return buf;
        },
        size: size,
        name: name
    }, count);
}

// http://stackoverflow.com/a/7460958/72637
function swapBytesPairs(fromBuffer, toBuffer) {
    toBuffer = toBuffer || fromBuffer
    var l = fromBuffer.length;
    for (var i = 1; i < l; i += 2) {
        var a = fromBuffer[i - 1];
        toBuffer[i - 1] = fromBuffer[i];
        toBuffer[i] = a;
    }
    return toBuffer
}

_.byte = bytefield.bind({
    b2v: function (b) { return b; },
    vTb: function (v,b) { if (!v) return 0; v.copy(b); return v.length; }
});

_.char = bytefield.bind({
    b2v: function (b) {
        var v = b.toString('utf8'),
            z = v.indexOf('\0');
        return (~z) ? v.slice(0, z) : v;
    },
    vTb: function (v,b) {
        v || (v = '');
        return b.write(v, 'utf8');
    }
});

_.char16le = bytefield.bind({
    b2v: function (b) {
        var v = b.toString('utf16le'),
            z = v.indexOf('\0');
        return (~z) ? v.slice(0, z) : v;
    },
    vTb: function (v,b) {
        v || (v = '');
        return b.write(v, 'utf16le');
    }
});

_.char16be = bytefield.bind({
    b2v: function (b) {
        var temp = newBuffer(b.length);
        swapBytesPairs(b, temp);
        var v = temp.toString('utf16le'),
            z = v.indexOf('\0');
        return (~z) ? v.slice(0, z) : v;
    },
    vTb: function (v,b) {
        v || (v = '');
        var len = b.write(v, 'utf16le');
        swapBytesPairs(b)
        return len;
    }
});

function standardField(sig, size) {
    var read = 'read'+sig,
        dump = 'write'+sig;
    size || (size = +sig.match(/\d+/)[0] >> 3);
    return function (name, count) {
        if (typeof name !== 'string') {
            count = name;
            name = null;
        }
        return arrayizeField({
            valueFromBytes: function (buf, off) {
                off || (off = {bytes:0});
                var val = buf[read](off.bytes);
                addField(off, this);
                return val;
            },
            bytesFromValue: function (val, buf, off) {
                val || (val = 0);
                buf || (buf = newBuffer(this.size));
                off || (off = {bytes:0});
                buf[dump](val, off.bytes);
                addField(off, this);
                return buf;
            },
            size: size,
            name: name
        }, count);
    };
}

_.float32 = standardField('FloatBE',4);
_.float64 = standardField('DoubleBE',8);
_.float32le = standardField('FloatLE',4);
_.float64le = standardField('DoubleLE',8);

_.uint8 = standardField('UInt8');
_.uint16 = standardField('UInt16BE');
_.uint32 = standardField('UInt32BE');
_.uint16le = standardField('UInt16LE');
_.uint32le = standardField('UInt32LE');

_.int8 = standardField('Int8');
_.int16 = standardField('Int16BE');
_.int32 = standardField('Int32BE');
_.int16le = standardField('Int16LE');
_.int32le = standardField('Int32LE');


_.derive = function (orig, pack, unpack) {
    return function (name, count) {
        if (typeof name !== 'string') {
            count = name;
            name = null;
        }
        return arrayizeField(extend({
            valueFromBytes: function (buf, off) {
                return unpack(orig.valueFromBytes(buf, off));
            },
            bytesFromValue: function (val, buf, off) {
                return orig.bytesFromValue(pack(val), buf, off);
            },
            name: name
        }, ('width' in orig) ? {width:orig.width} : {size:orig.size}), count);
    }
};

module.exports = _;

}).call(this,require("buffer").Buffer)
},{"buffer":8}],35:[function(require,module,exports){
(function (setImmediate,clearImmediate){
var nextTick = require('process/browser.js').nextTick;
var apply = Function.prototype.apply;
var slice = Array.prototype.slice;
var immediateIds = {};
var nextImmediateId = 0;

// DOM APIs, for completeness

exports.setTimeout = function() {
  return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
};
exports.setInterval = function() {
  return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
};
exports.clearTimeout =
exports.clearInterval = function(timeout) { timeout.close(); };

function Timeout(id, clearFn) {
  this._id = id;
  this._clearFn = clearFn;
}
Timeout.prototype.unref = Timeout.prototype.ref = function() {};
Timeout.prototype.close = function() {
  this._clearFn.call(window, this._id);
};

// Does not start the time, just sets up the members needed.
exports.enroll = function(item, msecs) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = msecs;
};

exports.unenroll = function(item) {
  clearTimeout(item._idleTimeoutId);
  item._idleTimeout = -1;
};

exports._unrefActive = exports.active = function(item) {
  clearTimeout(item._idleTimeoutId);

  var msecs = item._idleTimeout;
  if (msecs >= 0) {
    item._idleTimeoutId = setTimeout(function onTimeout() {
      if (item._onTimeout)
        item._onTimeout();
    }, msecs);
  }
};

// That's not how node.js implements it but the exposed api is the same.
exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
  var id = nextImmediateId++;
  var args = arguments.length < 2 ? false : slice.call(arguments, 1);

  immediateIds[id] = true;

  nextTick(function onNextTick() {
    if (immediateIds[id]) {
      // fn.call() is faster so we optimize for the common use-case
      // @see http://jsperf.com/call-apply-segu
      if (args) {
        fn.apply(null, args);
      } else {
        fn.call(null);
      }
      // Prevent ids from leaking
      exports.clearImmediate(id);
    }
  });

  return id;
};

exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
  delete immediateIds[id];
};
}).call(this,require("timers").setImmediate,require("timers").clearImmediate)
},{"process/browser.js":17,"timers":35}],36:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],37:[function(require,module,exports){
module.exports = function (obj) {
    Array.prototype.slice.call(arguments, 1).forEach(function (ext) {
        if (ext) Object.keys(ext).forEach(function (key) {
            obj[key] = ext[key];
        });
    });
    return obj;
};
},{}],38:[function(require,module,exports){
// see http://staff.washington.edu/dittrich/misc/fatgen103.pdf
// and http://www.cse.scu.edu/~tschwarz/COEN252_09/Lectures/FAT.html

var _ = require('struct-fu'),
    __ = require("./helpers.js");

var bootBase = _.struct([
    _.byte('jmpBoot', 3),
    _.char('OEMName', 8),
    _.uint16le('BytsPerSec'),
    _.uint8('SecPerClus'),
    _.uint16le('ResvdSecCnt'),      // Rsvd in table, but Resvd in calcs…
    _.uint8('NumFATs'),
    _.uint16le('RootEntCnt'),
    _.uint16le('TotSec16'),
    _.uint8('Media'),
    _.uint16le('FATSz16'),
    _.uint16le('SecPerTrk'),
    _.uint16le('NumHeads'),
    _.uint32le('HiddSec'),
    _.uint32le('TotSec32')
]);

var bootInfo = _.struct([
    _.uint8('DrvNum'),
    _.uint8('Reserved1'),
    _.uint8('BootSig'),
    _.uint32le('VolID'),
    _.char('VolLab', 11),
    _.char('FilSysType', 8)
]);

exports.boot16 = _.struct([
    bootBase,
    bootInfo
]);

exports.boot32 = _.struct([
    bootBase,
    _.uint32le('FATSz32'),
    _.struct('ExtFlags', [
        _.ubit('NumActiveFAT', 4),
        _.ubit('_reserved1', 3),
        _.bool('MirroredFAT'),
        _.ubit('_reserved2', 8)
    ].reverse()),
    _.struct('FSVer', [
        _.uint8('Major'),
        _.uint8('Minor')
    ]),
    _.uint32le('RootClus'),
    _.uint16le('FSInfo'),
    _.uint16le('BkBootSec'),
    _.byte('Reserved', 12),
    bootInfo
]);


var _time = _.struct([
    _.ubit('hours',5),
    _.ubit('minutes',6),
    _.ubit('seconds_2',5)
]), time = {
    valueFromBytes: function (buf, off) {
        off || (off = {bytes:0});
        
        var _buf = __.bufferFrom([buf[off.bytes+1], buf[off.bytes+0]]),
            val = _time.valueFromBytes(_buf);
        off.bytes += this.size;
        return val;
    },
    bytesFromValue: function (val, buf, off) {
        val || (val = {hours:0, minutes:0, seconds_2:0});
        buf || (buf = __.allocBuffer(this.size));
        off || (off = {bytes:0});
        
        var _buf = _time.bytesFromValue(val);
        buf[off.bytes+1] = _buf[0];
        buf[off.bytes+0] = _buf[1];
        off.bytes += this.size;
        return buf;
    },
    size: _time.size
};

var _date = _.struct([
    _.ubit('year',7),
    _.ubit('month',4),
    _.ubit('day',5)
]), date = {
    valueFromBytes: function (buf, off) {
        off || (off = {bytes:0});
        
        var _buf = __.bufferFrom([buf[off.bytes+1], buf[off.bytes+0]]),
            val = _date.valueFromBytes(_buf);
        off.bytes += this.size;
        return val;
    },
    bytesFromValue: function (val, buf, off) {
        val || (val = {year:0, month:0, day:0});
        buf || (buf = __.allocBuffer(this.size));
        off || (off = {bytes:0});
        
        var _buf = _date.bytesFromValue(val);
        buf[off.bytes+1] = _buf[0];
        buf[off.bytes+0] = _buf[1];
        off.bytes += this.size;
        return buf;
    },
    size: _date.size
};

exports.dirEntry = _.struct([
    _.struct('Name', [
        _.char('filename',8),
        _.char('extension',3)
    ]),
    _.struct('Attr', [
        _.bool('readonly'),
        _.bool('hidden'),
        _.bool('system'),
        _.bool('volume_id'),
        _.bool('directory'),
        _.bool('archive'),
        _.ubit('reserved', 2)
    ].reverse()),
    _.byte('NTRes', 1),
    _.uint8('CrtTimeTenth'),
    _.struct('CrtTime', [time]),
    _.struct('CrtDate', [date]),
    _.struct('LstAccDate', [date]),
    _.uint16le('FstClusHI'),
    _.struct('WrtTime', [time]),
    _.struct('WrtDate', [date]),
    _.uint16le('FstClusLO'),
    _.uint32le('FileSize')
]);
exports.entryDoneFlag = 0x00;
exports.entryFreeFlag = 0xE5;
exports.entryIsE5Flag = 0x05;

exports.dirEntry_simple = _.struct([
    _.struct('Name', [
        _.char('filename',8),
        _.char('extension',3)
    ]),
    _.padTo(exports.dirEntry.size)
    /*
    _.uint8('Attr_raw'),
    _.byte('NTRes', 1),
    _.byte('Crt_raw', 1+2+2),
    _.byte('Lst_raw', 2),
    _.uint16le('FstClusHI'),
    _.byte('Wrt_raw', 2+2),
    _.uint16le('FstClusLO'),
    _.uint32le('FileSize')
    */
]);


exports.lastLongFlag = 0x40;
exports.longDirFlag = 0x0F;
exports.longDirEntry = _.struct([
    _.uint8('Ord'),
    _.char16le('Name1', 10),
    _.uint8('Attr_raw'),
    _.uint8('Type'),
    _.uint8('Chksum'),
    _.char16le('Name2', 12),
    _.uint16le('FstClusLO'),
    _.char16le('Name3', 4)
]);

if (exports.longDirEntry.size !== exports.dirEntry.size) throw Error("Structs ain't right!");

exports.fatField = {
    'fat12': _.struct('Status', [
        _.ubit('field0bc', 8),
        _.ubit('field1c', 4),
        _.ubit('field0a', 4),
        _.ubit('field1ab', 8),
    ]),
    'fat16': _.uint16le('Status'),
    'fat32': _.uint32le('Status')       // more properly this 4 bits reserved + uint28le
};

exports.fatPrefix = {
    'fat12': 0xF00,
    'fat16': 0xFF00,
    'fat32': 0x0FFFFF00
};

exports.fatStat = {
    free: 0x00,
    _undef: 0x01,
    rsvMin: 0xF0,
    bad: 0xF7,
    eofMin: 0xF8,
    eof: 0xFF
};

exports._I = {
    RUSR: 0400,
    WUSR: 0200,
    XUSR: 0100,
    
    RGRP: 0040,
    WGRP: 0020,
    XGRP: 0010,
    
    ROTH: 0004,
    WOTH: 0002,
    XOTH: 0001,
    
    SUID: 04000,
    SGID: 02000,
    SVTX: 01000,
    
    FDIR: 040000,
    FREG: 0100000,
};

exports._I.RWXU = exports._I.RUSR | exports._I.WUSR | exports._I.XUSR;
exports._I.RWXG = exports._I.RGRP | exports._I.WGRP | exports._I.XGRP;
exports._I.RWXO = exports._I.ROTH | exports._I.WOTH | exports._I.XOTH;
exports._I._sss = exports._I.SUID | exports._I.SGID | exports._I.SVTX;
exports._I._chmoddable = exports._I.RWXU | exports._I.RWXG | exports._I.RWXO | exports._I._sss;

var _errors = {
    IO: "Input/output error",
    NOENT: "No such file or directory",
    INVAL: "Invalid argument",
    EXIST: "File exists",
    NAMETOOLONG: "Filename too long",
    NOSPC: "No space left on device",
    NOSYS: "Function not supported",
    ROFS: "ROFLCopter file system",
    NOTDIR: "Not a directory",
    BADF: "Bad file descriptor",
    EXIST: "File exists",
    ISDIR: "Is a directory",
    ACCES: "Permission denied",
    NOSYS: "Function not implemented",
    _TODO: "Not implemented yet!"
};

exports.err = {};
Object.keys(_errors).forEach(function (sym) {
    var msg = _errors[sym];
    exports.err[sym] = function () {
        var e = new Error(msg);
        e.code = sym;
        return e;
    };
});

},{"./helpers.js":4,"struct-fu":34}],39:[function(require,module,exports){
var S = require("./structs.js"),
    c = require("./chains.js"),
    $ = require("./cache.js"),
    _ = require("./helpers.js");

exports.init = function (volume, opts, bootSector) {
    if (bootSector[510] !== 0x55 || bootSector[511] !== 0xAA) throw Error("Invalid volume signature!");
    
    var isFAT16 = bootSector.readUInt16LE(S.boot16.fields['FATSz16'].offset),
        bootStruct = (isFAT16) ? S.boot16 : S.boot32,
        BS = bootStruct.valueFromBytes(bootSector);
    _.log(_.log.DBG, "Boot sector info:", BS);
    bootSector = null;      // allow GC
    if (!BS.BytsPerSec) throw Error("This looks like an ExFAT volume! (unsupported)");
    else if (BS.BytsPerSec !== volume.sectorSize) throw Error("Sector size mismatch with FAT table.");
    
    var FATSz = (isFAT16) ? BS.FATSz16 : BS.FATSz32,
        rootDirSectors = Math.ceil((BS.RootEntCnt * 32) / BS.BytsPerSec),
        firstDataSector = BS.ResvdSecCnt + (BS.NumFATs * FATSz) + rootDirSectors,
        totSec = (BS.TotSec16) ? BS.TotSec16 : BS.TotSec32,
        dataSec = totSec - firstDataSector,
        countofClusters = Math.floor(dataSec / BS.SecPerClus);
    // avoid corrupting sectors from other partitions or whatnot
    if (totSec > volume.numSectors) throw Error("Volume size mismatch!");
    
    var fatType;
    if (countofClusters < 4085) {
        fatType = 'fat12';
    } else if (countofClusters < 65525) {
        fatType = 'fat16';
    } else {
        fatType = 'fat32';
    }
    
    _.log(_.log.DBG, "rootDirSectors", rootDirSectors, "firstDataSector", firstDataSector, "countofClusters", countofClusters, "=>", fatType);
    
    var vol = {};
    
    vol.opts = opts;
    
    vol._sectorSize = BS.BytsPerSec;
    vol._sectorsPerCluster = BS.SecPerClus;
    vol._firstSectorOfCluster = function (n) {
        return firstDataSector + (n-2)*vol._sectorsPerCluster;
    };
    
    vol._makeCache = function () {
        return $.wrapDriver(volume);
    };
    
    vol._readSectors = function (cache, secNum, dest, cb) {
        if (typeof dest === 'function') {
            cb = dest;
            dest = _.allocBuffer(vol._sectorSize);
        }
        _.log(_.log.DBG, "vol._readSectors", secNum, dest.length);
        if (secNum < volume.numSectors) cache.readSectors(secNum, dest, function (e) { cb(e, dest); });
        else throw Error("Invalid sector number!");
    };
    
    vol._writeSectors = function (cache, secNum, data, cb) {
        _.log(_.log.DBG, "vol._writeSectors", secNum, data.length);
        // NOTE: these are internal assertions, public API will get proper `S.err`s
        if (data.length % volume.sectorSize) throw Error("Buffer length not a multiple of sector size");
        else if (opts.ro) throw Error("Read-only filesystem");
        else if (secNum < volume.numSectors) cache.writeSectors(secNum, data, cb);
        else throw Error("Invalid sector number!");
    };
    
    function fatInfoForCluster(n) {
        var entryStruct = S.fatField[fatType],
            FATOffset = (fatType === 'fat12') ? Math.floor(n/2) * entryStruct.size : n * entryStruct.size,
            SecNum = BS.ResvdSecCnt + Math.floor(FATOffset / BS.BytsPerSec);
            EntOffset = FATOffset % BS.BytsPerSec;
        return {sector:SecNum-BS.ResvdSecCnt, offset:EntOffset, struct:entryStruct};
    }
    
    // TODO: all this FAT manipulation is crazy inefficient! needs read caching *and* write caching
    //        …the best place for cache might be in `volume` handler, though. add a `flush` method to that spec?
    // TODO: how should we handle redundant FATs? mirror every write? just ignore completely? copy-on-eject?
    
    var fatChain = c.sectorChain(vol, BS.ResvdSecCnt, FATSz);
    fatChain.cacheAdvice = 'RANDOM';
    
    vol.fetchFromFAT = function (clusterNum, cb) {
        var info = fatInfoForCluster(clusterNum);
        fatChain.readFromPosition(info, info.struct.size, function (e,n,d) {
            if (e) return cb(e);
            var status = info.struct.valueFromBytes(d), prefix;
            if (fatType === 'fat12') {
                if (clusterNum % 2) {
                    status = (status.field1ab << 4) + status.field1c;
                } else {
                    status = (status.field0a << 8) + status.field0bc;
                }
            }
            else if (fatType === 'fat32') {
                status &= 0x0FFFFFFF;
            }
            
            var prefix = S.fatPrefix[fatType];
            if (status === S.fatStat.free) cb(null, 'free');
            else if (status === S.fatStat._undef) cb(null, '-invalid-');
            else if (status > prefix+S.fatStat.eofMin) cb(null, 'eof');
            else if (status === prefix+S.fatStat.bad) cb(null, 'bad');
            else if (status > prefix+S.fatStat.rsvMin) cb(null, 'reserved');
            else cb(null, status);
        });
    };
    
    vol.storeToFAT = function (clusterNum, status, cb) {
        if (typeof status === 'string') {
            status = S.fatStat[status];
            status += S.fatPrefix[fatType];
        }
        var info = fatInfoForCluster(clusterNum);
        // TODO: technically fat32 needs to *preserve* the high 4 bits
        if (fatType === 'fat12') fatChain.readFromPosition(info, info.struct.size, function (e,n,d) {
            var value = info.struct.valueFromBytes(d);
            if (clusterNum % 2) {
                value.field1ab = status >>> 4;
                value.field1c = status & 0x0F;
            } else {
                value.field0a = status >>> 8;
                value.field0bc = status & 0xFF;
            }
            var entry = info.struct.bytesFromValue(value);
            fatChain.writeToPosition(info, entry, cb);
        }); else {
            var entry = info.struct.bytesFromValue(status);
            fatChain.writeToPosition(info, entry, cb);
        }
    };
    
    vol.allocateInFAT = function (hint, cb) {
        if (typeof hint === 'function') {
            cb = hint;
            hint = 2;   // TODO: cache a better starting point?
        }
        function searchForFreeCluster(num, cb) {
            if (num < countofClusters) vol.fetchFromFAT(num, function (e, status) {
                if (e) cb(e);
                else if (status === 'free') cb(null, num);
                else searchForFreeCluster(num+1, cb);
            }); else cb(S.err.NOSPC());     // TODO: try searching backwards from hint…
        }
        searchForFreeCluster(hint, function (e, clusterNum) {
            if (e) cb(e);
            else vol.storeToFAT(clusterNum, 'eof', cb.bind(null,null,clusterNum));
        });
    };
    
    vol.rootDirectoryChain = (isFAT16) ?
        c.sectorChain(vol, firstDataSector - rootDirSectors, rootDirSectors) :
        c.clusterChain(vol, BS.RootClus);
    vol.rootDirectoryChain.cacheAdvice = 'WILLNEED';
    vol.chainForCluster = c.clusterChain.bind(c, vol);
    vol.chainFromJSON = function (d) {
        return ('numSectors' in d) ?
            c.sectorChain(vol, d.firstSector, d.numSectors) :
            c.clusterChain(vol, d.firstCluster);
    };
    
    return vol;
}

},{"./cache.js":1,"./chains.js":2,"./helpers.js":4,"./structs.js":38}]},{},[5])(5)
});
