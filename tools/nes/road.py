#!/usr/bin/python

# Import a library of functions called 'pygame'
import pygame
import random
from math import pi
 
# Initialize the game engine
pygame.init()
 
# Define the colors we will use in RGB format
BLACK = (  0,   0,   0)
WHITE = (255, 255, 255)
BLUE =  (  0,   0, 255)
GREEN = (  0, 184,   0)

CURBING = [
    (136,20,0),
    (168,16,0),
]

CENLINE = [
    (124,124,124),
    (188,188,188),
]

MOUNTAINS = [
    (80,48,0),
    (172,124,0)
]
 
# Set the height and width of the screen
size = [512, 240]
y0 = 112
x0 = 256
screen = pygame.display.set_mode(size)
 
pygame.display.set_caption("Example code for the draw module")
 
#Loop until the user clicks the close button.
done = False
clock = pygame.time.Clock()
 
while not done:
 
    # This limits the while loop to a max of 10 times per second.
    # Leave this out and we will use all CPU we can.
    clock.tick(10)
     
    for event in pygame.event.get(): # User did something
        if event.type == pygame.QUIT: # If user clicked close
            done=True # Flag that we are done so we exit this loop

    # All drawing code happens after the for loop and but
    # inside the main while done==False loop.
     
    # Clear the screen and set the screen background
    screen.fill(BLUE)
    pygame.draw.rect(screen, GREEN, [0, y0, 512, 240-y0])
    
    # draw the road
    for y in range(y0,240):
        i = y-y0
        rw = i*2
        cw = rw/4
        lw = rw/32
        z = 500.0/(i+1)
        curbcol = CURBING[int(z) % 2]
        cencol = CENLINE[int(z) % 2]
        if i < 16:
            cencol = BLACK #CENLINE[0]
        if i < 0:
            curbcol = BLACK #CURBING[0]
        pygame.draw.line(screen, BLACK, [x0-rw, y], [x0+rw, y], 1)
        pygame.draw.line(screen, curbcol, [x0-rw-cw, y], [x0-rw, y], 1)
        pygame.draw.line(screen, curbcol, [x0+rw, y], [x0+rw+cw, y], 1)
        pygame.draw.line(screen, cencol, [x0-rw/3-lw, y], [x0-rw/3+lw, y], 1)
        pygame.draw.line(screen, cencol, [x0+rw/3-lw, y], [x0+rw/3+lw, y], 1)
        
    # draw mountains
    h1 = 1
    h2 = 2
    for x in range(0,512):
        pygame.draw.line(screen, MOUNTAINS[0], [x, y0-1], [x, y0-h1], 1)
        pygame.draw.line(screen, MOUNTAINS[1], [x, y0-1], [x, y0-h2], 1)
        if random.randint(0,8) > h1:
            h1 += 1
        elif h1 > 1:
            h1 -= 1
        if random.randint(0,6) > h2:
            h2 += 1
        elif h2 > 1:
            h2 -= 1
    
    # Go ahead and update the screen with what we've drawn.
    # This MUST happen after all the other drawing commands.
    pygame.display.flip()

pygame.image.save(screen, 'road.png')
 
# Be IDLE friendly
pygame.quit()
