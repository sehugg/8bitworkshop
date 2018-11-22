#!/usr/bin/python

import sys
from xml.dom import minidom

def textToFloat(name):
        if name:
                return float(name)
        else:
                return None

def textToColor(name,opacity):
        if name is None or not name[0] == '#':
                return None
        color = int(name[1:],16) << 8
        if opacity:
                print(('opacity',opacity))
        return color

svg_file = sys.argv[1]

doc = minidom.parse(svg_file)  # parseString also exists
groups = doc.getElementsByTagName('g')
for grp in groups:
        groupID = grp.getAttribute('id')
        paths = grp.getElementsByTagName('path')
        print((groupID,paths))
        if len(paths):
                for path in paths:
                        shape = {}
                        d = path.getAttribute('d')
                        styleAttrs = {}
                        style = path.getAttribute('style')
                        sarr = style.split(';')
                        for s in sarr:
                                nvarr = s.split(':', 2)
                                if len(nvarr) == 2:
                                        styleAttrs[nvarr[0]] = nvarr[1]
                        print((path,d,styleAttrs))
                        shape['pts'] = []
                        shape['currentColor'] = textToColor(styleAttrs.get("stroke"), styleAttrs.get("stroke-opacity"))
                        shape['currentWidth'] = textToFloat(styleAttrs.get("strokeWidth"))
                        hidden = "none" == styleAttrs.get("display")
                        cmds = d.split(' ')
                        x = 0
                        y = 0
                        i0 = 0 
                        start = True
                        for cmd in cmds:
                                print(cmd)
                                ch = cmd[0]
                                if ch == 'm' or ch == 'l':
                                        start = True
                                elif ch == 'z':
                                        origin = shape['pts'][i0]
                                        shape.lineTo(origin.x, origin.y)
                                elif ch == 'c':
                                        skip = True
                                else:
                                        xy = cmd.split(',')
                                        print(xy)
                                        x += float(xy[0])
                                        y -= float(xy[1])
                                        if start or hidden:
                                                shape.moveTo(x,y)
                                        else:
                                                shape.lineTo(x,y)
                                        start = False                                        


doc.unlink()
