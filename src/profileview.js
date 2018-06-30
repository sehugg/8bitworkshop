/* profiler window: currently unused */

var profilelist;

var pcdata = {};
var prof_reads, prof_writes;

function scrollProfileView(_ed) {
  _ed.on('scroll', function(ed, changeobj) {
    if (profilelist) {
      profilelist.container.scrollTop = ed.getScrollInfo().top;
    }
  });
}

function updateProfileWindow() {
  if (profilelist && sourcefile) {
    $("#profileview").find('[data-index]').each(function(i,e) {
      var div = $(e);
      var lineno = div.attr('data-index') | 0;
      var newtext = getProfileLine(lineno+1);
      if (newtext) {
        var oldtext = div.text();
        if (oldtext != newtext)
          div.text(newtext);
      }
    });
  }
}

function createProfileWindow() {
  profilelist = new VirtualList({
    w:$("#emulator").width(),
    h:$("#emulator").height(),
    itemHeight: getVisibleEditorLineHeight(),
    totalRows: getVisibleSourceFile().lineCount(),
    generatorFn: function(row) {
      var div = document.createElement("div");
      div.appendChild(document.createTextNode("."));
      return div;
    }
  });
  $("#profileview").empty().append(profilelist.container);
  updateProfileWindow();
}

function resetProfiler() {
  prof_reads = [];
  prof_writes = [];
  pcdata = [];
  dumplines = null;
}

function profileWindowCallback(a,v) {
  if (platform.getPC) {
    var pc = platform.getPC();
    var pcd = pcdata[pc];
    if (!pcd) {
      pcd = pcdata[pc] = {nv:1};
    }
    if (a != pc) {
      if (v >= 0) {
        pcd.lastwa = a;
        pcd.lastwv = v;
      } else {
        pcd.lastra = a;
        pcd.lastrv = platform.readAddress(a);
      }
    } else {
      pcd.nv++;
    }
  }
}

function getProfileLine(line) {
  var srcfile = getVisibleSourceFile();
  var offset = srcfile.line2offset[line];
  var offset2 = srcfile.line2offset[line+1];
  if (!(offset2 > offset)) offset2 = offset+1;
  var s = '';
  var nv = 0;
  while (offset < offset2) {
    var pcd = pcdata[offset];
    if (pcd) {
      nv += pcd.nv;
      if (pcd.lastra >= 0) {
        s += " rd [" + hex(pcd.lastra,4) + "] == " + hex(pcd.lastrv,2);
      }
      if (pcd.lastwa >= 0) {
        s += " wr " + hex(pcd.lastwv,2) + " -> [" + hex(pcd.lastwa,4) + "]";
      }
    }
    offset++;
  }
  return nv ? (lpad(nv+"",8) + s) : '.';
}

function toggleProfileWindow() {
  if ($("#memoryview").is(':visible')) toggleMemoryWindow();
  if ($("#profileview").is(':visible')) {
    profilelist = null;
    platform.getProbe().deactivate();
    $("#emulator").show();
    $("#profileview").hide();
  } else {
    createProfileWindow();
    platform.getProbe().activate(profileWindowCallback);
    $("#emulator").hide();
    $("#profileview").show();
  }
}

