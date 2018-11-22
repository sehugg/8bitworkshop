
import math

#n = 8
#m = 127

n = 32
m = 127

n = 4
m = 7

for i in range(0,n*4):
    print('%d,' % int(round(math.sin(i*math.pi/2/n)*m)), end='')
    if i % 16 == 15:
        print('')
