#!/usr/bin/python
#
# C header file -> Markdown-ish converter 

import sys,re

re_define = re.compile("^#define\s+(\w+)([(][^)]+[)])?")
re_func = re.compile("^(\w+\s+[A-Za-z_ ]+[(][^)]+[)]);")
re_comment1 = re.compile("//(.+)\\\\?")

comment = ''

def dump(s):
    global comment
    print('`'+ s.strip() +'`')
    print(': ' + comment.strip())
    comment = ''

files = sys.argv[1:]
for fn in files:
    with open(fn,'r') as f:
        print("## " + fn)
        l = f.readline()
        while l:
            l = l.strip()
            m1 = re_define.match(l)
            m2 = re_func.match(l)
            m3 = re_comment1.match(l)
            if m3:
                comment += m3.group(1)
            if m1:
                s = m1.group(1)
                if m1.group(2):
                   s += m1.group(2)
                dump(s)
            elif m2:
                s = m2.group(1)
                s = s.replace('void ','').replace('(void)','()')
                s = s.replace('__fastcall__',' ')
                s = s.replace('  ',' ')
                s = s.replace('  ',' ')
                dump(s)
            elif not m3:
                if l != '':
                    print('<!--' + l + '-->')
                else:
                    print('')
            l = f.readline()

