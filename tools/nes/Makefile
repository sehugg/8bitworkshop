
all: nametable.dat

clean:
	rm -f *.dat road.png

nametable.dat: road.png
	makechr -e error.png $< #-b 0000ff

road.png: road.py
	python road.py
