"use strict";

function lpad(s:string, n:number):string {
  s += ''; // convert to string
  while (s.length<n) s=" "+s;
  return s;
}

function byte2signed(b:number):number {
  b &= 0xff;
  return (b < 0x80) ? b : -(256-b);
}

function getFilenameForPath(s:string):string {
  var toks = s.split('/');
  return toks[toks.length-1];
}

function getFilenamePrefix(s:string):string {
  var pos = s.lastIndexOf('.');
  return (pos > 0) ? s.substr(0, pos) : s;
}

function hex(v:number, nd?:number) {
  if (!nd) nd = 2;
  return toradix(v,nd,16);
}

function tobin(v:number, nd?:number) {
  if (!nd) nd = 8;
  return toradix(v,nd,2);
}

function toradix(v:number, nd:number, radix:number) {
  try {
    var s = v.toString(radix).toUpperCase();
    while (s.length < nd)
      s = "0" + s;
    return s;
  } catch (e) {
    return v+"";
  }
}

function arrayCompare(a:any[], b:any[]):boolean {
  if (a == null && b == null) return true;
  if (a == null) return false;
  if (b == null) return false;
  if (a.length != b.length) return false;
  for (var i=0; i<a.length; i++)
    if (a[i] != b[i])
      return false;
  return true;
}

function invertMap(m:{}):{} {
  var r = {};
  if (m) {
    for (var k in m) r[m[k]] = k;
  }
  return r;
}

function highlightDifferences(s1:string, s2:string):string {
  var split1 = s1.split(/(\S+\s+)/).filter(function(n) {return n});
  var split2 = s2.split(/(\S+\s+)/).filter(function(n) {return n});
  var i = 0;
  var j = 0;
  var result = "";
  while (i < split1.length && j < split2.length) {
    var w1 = split1[i];
    var w2 = split2[j];
    if (w2 && w2.indexOf("\n") >= 0) {
      while (i < s1.length && split1[i].indexOf("\n") < 0)
        i++;
    }
    if (w1 != w2) {
      w2 = '<span class="hilite">' + w2 + '</span>';
    }
    result += w2;
    i++;
    j++;
  }
  while (j < split2.length) {
      result += split2[j++];
  }
  return result;
}

function lzgmini() {

  // Constants
  var LZG_HEADER_SIZE = 16;
  var LZG_METHOD_COPY = 0;
  var LZG_METHOD_LZG1 = 1;

  // LUT for decoding the copy length parameter
  var LZG_LENGTH_DECODE_LUT = [2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,
                               20,21,22,23,24,25,26,27,28,29,35,48,72,128];

  // Decoded data (produced by the decode() method)
  var outdata = null;

  // Calculate the checksum
  var calcChecksum = function(data) {
    var a = 1;
    var b = 0;
    var i = LZG_HEADER_SIZE;
    while (i < data.length)
    {
      a = (a + (data[i] & 0xff)) & 0xffff;
      b = (b + a) & 0xffff;
      i++;
    }
    return (b << 16) | a;
  }

  // Decode LZG coded data. The function returns the size of the decoded data.
  // Use any of the get* methods to retrieve the decoded data.
  this.decode = function(data:number[]):number[] {
    // Start by clearing the decompressed array in this object
    outdata = null;

    // Check magic ID
    if ((data.length < LZG_HEADER_SIZE) || (data[0] != 76) ||
         (data[1] != 90) || (data[2] != 71))
    {
      return null;
    }

    // Calculate & check the checksum
    var checksum = ((data[11] & 0xff) << 24) |
                   ((data[12] & 0xff) << 16) |
                   ((data[13] & 0xff) << 8) |
                   (data[14] & 0xff);
    if (calcChecksum(data) != checksum)
    {
      return null;
    }

    // Check which method to use
    var method = data[15] & 0xff;
    if (method == LZG_METHOD_LZG1)
    {
      // Get marker symbols
      var m1 = data[16] & 0xff;
      var m2 = data[17] & 0xff;
      var m3 = data[18] & 0xff;
      var m4 = data[19] & 0xff;

      // Main decompression loop
      var symbol, b, b2, b3, len, offset;
      var dst = new Array();
      var dstlen = 0;
      var k = LZG_HEADER_SIZE + 4;
      var datalen = data.length;
      while (k <= datalen)
      {
        symbol = data[k++] & 0xff;
        if ((symbol != m1) && (symbol != m2) && (symbol != m3) && (symbol != m4))
        {
          // Literal copy
          dst[dstlen++] = symbol;
        }
        else
        {
          b = data[k++] & 0xff;
          if (b != 0)
          {
            // Decode offset / length parameters
            if (symbol == m1)
            {
              // marker1 - "Distant copy"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              b2 = data[k++] & 0xff;
              b3 = data[k++] & 0xff;
              offset = (((b & 0xe0) << 11) | (b2 << 8) | b3) + 2056;
            }
            else if (symbol == m2)
            {
              // marker2 - "Medium copy"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              b2 = data[k++] & 0xff;
              offset = (((b & 0xe0) << 3) | b2) + 8;
            }
            else if (symbol == m3)
            {
              // marker3 - "Short copy"
              len = (b >> 6) + 3;
              offset = (b & 63) + 8;
            }
            else
            {
              // marker4 - "Near copy (incl. RLE)"
              len = LZG_LENGTH_DECODE_LUT[b & 0x1f];
              offset = (b >> 5) + 1;
            }

            // Copy the corresponding data from the history window
            for (i = 0; i < len; i++)
            {
              dst[dstlen] = dst[dstlen-offset];
              dstlen++;
            }
          }
          else
          {
            // Literal copy (single occurance of a marker symbol)
            dst[dstlen++] = symbol;
          }
        }
      }

      // Store the decompressed data in the lzgmini object for later retrieval
      outdata = dst;
      return outdata;
    }
    else if (method == LZG_METHOD_COPY)
    {
      // Plain copy
      var dst = new Array();
      var dstlen = 0;
      var datalen = data.length;
      for (var i = LZG_HEADER_SIZE; i < datalen; i++)
      {
        dst[dstlen++] = data[i] & 0xff;
      }
      outdata = dst;
      return outdata;
    }
    else
    {
      // Unknown method
      return null;
    }
  }

  // Get the decoded byte array
  this.getByteArray = function():number[]
  {
    return outdata;
  }

  // Get the decoded string from a Latin 1 (or ASCII) encoded array
  this.getStringLatin1 = function():string
  {
    var str = "";
    if (outdata != null)
    {
      var charLUT = new Array();
      for (var i = 0; i < 256; ++i)
        charLUT[i] = String.fromCharCode(i);
      var outlen = outdata.length;
      for (var i = 0; i < outlen; i++)
        str += charLUT[outdata[i]];
    }
    return str;
  }

  // Get the decoded string from an UTF-8 encoded array
  this.getStringUTF8 = function():string
  {
    var str = "";
    if (outdata != null)
    {
      var charLUT = new Array();
      for (var i = 0; i < 128; ++i)
        charLUT[i] = String.fromCharCode(i);
      var c;
      var outlen = outdata.length;
      for (var i = 0; i < outlen;)
      {
        c = outdata[i++];
        if (c < 128)
        {
          str += charLUT[c];
        }
        else
        {
          if ((c > 191) && (c < 224))
          {
            c = ((c & 31) << 6) | (outdata[i++] & 63);
          }
          else
          {
            c = ((c & 15) << 12) | ((outdata[i] & 63) << 6) | (outdata[i+1] & 63);
            i += 2;
          }
          str += String.fromCharCode(c);
        }
      }
    }
    return str;
  }
}

function stringToByteArray(s:string) : Uint8Array {
  var a = new Uint8Array(s.length);
  for (var i=0; i<s.length; i++)
    a[i] = s.charCodeAt(i);
  return a;
}
