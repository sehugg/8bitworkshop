
import os,sys,codecs

for root, dirs, files in os.walk("./presets"):
    for fn in files:
        path = root + '/' + fn
        if fn[-1] == '~':
            continue
        try:
            with open(path,'r') as f:
                data = f.read()
            if data[0] != '\n':
                print(path,'no initial newline')
        except:
            print(path,sys.exc_info()[0])

